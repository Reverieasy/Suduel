import { create } from 'zustand'
import { requireBackend } from '../../lib/supabase'
import type { RoomSnapshot } from './types'

interface ActiveGame { userId: string; roomId: string; code: string }
const STORAGE_KEY='suduel.active-game.v1'
function read(): ActiveGame|null {
  try {
    const game=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null')
    const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
    return game&&typeof game.userId==='string'&&uuid.test(game.userId)&&typeof game.roomId==='string'&&uuid.test(game.roomId)&&typeof game.code==='string'&&/^[A-F0-9]{8}$/.test(game.code)?{userId:game.userId,roomId:game.roomId,code:game.code}:null
  } catch {return null}
}
function persist(game:ActiveGame|null) {
  try {if(game)localStorage.setItem(STORAGE_KEY,JSON.stringify(game));else localStorage.removeItem(STORAGE_KEY)} catch { /* Navigation recovery still works when storage is unavailable. */ }
}

export const useActiveGame=create<{game:ActiveGame|null;remember:(snapshot:RoomSnapshot,userId:string)=>void;forget:(roomId:string,userId:string)=>void}>((set,get)=>({
  game:read(),
  remember(snapshot,userId) {
    const continuing=snapshot.room.status!=='closed'&&snapshot.players.some(player=>player.user_id===userId)&&(snapshot.match?.status==='active'||snapshot.battle?.series.status==='active')
    if(!continuing){get().forget(snapshot.room.id,userId);return}
    const game={userId,roomId:snapshot.room.id,code:snapshot.room.code}
    const previous=get().game
    if(previous?.userId===userId&&previous.roomId===game.roomId&&previous.code===game.code)return
    persist(game);set({game})
  },
  forget(roomId,userId) {
    if(get().game?.roomId!==roomId||get().game?.userId!==userId)return
    persist(null);set({game:null})
  },
}))

// Passive RLS-protected reads only: a snapshot command would refresh last_seen
// and incorrectly keep an absent player connected to the competitive match.
export async function canReturnToGame(game:ActiveGame):Promise<boolean> {
  const {data,error}=await requireBackend().from('game_rooms')
    .select('id,code,status,expires_at,current_match:game_matches!room_current_match(status,ends_at,series:battle_series(status))')
    .eq('id',game.roomId).eq('code',game.code).retry(false).abortSignal(AbortSignal.timeout(5000)).maybeSingle()
  if(error)throw error
  if(!data||data.status==='closed'||Date.parse(data.expires_at)<=Date.now())return false
  const match=data.current_match
  return !!match&&(match.series?.status==='active'||(match.status==='active'&&Date.parse(match.ends_at)>Date.now()))
}
