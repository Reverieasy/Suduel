import { useEffect, useState } from 'react'
import { Link, matchPath, useLocation } from 'react-router'
import { ArrowRight, Gamepad2 } from 'lucide-react'
import { useAuth } from '../auth/store'
import { canReturnToGame, useActiveGame } from './activeGame'

export function ReturnToGame() {
  const game=useActiveGame(state=>state.game)
  const userId=useAuth(state=>state.session?.user.id), loading=useAuth(state=>state.loading)
  const {pathname}=useLocation()
  const inGame=!!game&&matchPath('/room/:code',pathname)?.params.code?.toUpperCase()===game.code
  const [check,setCheck]=useState<{roomId:string;userId:string;offline:boolean}|null>(null)
  useEffect(()=>{
    if(!game||loading||userId!==game.userId||inGame)return
    const candidate=game
    let active=true, checking=false
    async function refresh() {
      if(checking)return
      checking=true
      try {
        const returnable=await canReturnToGame(candidate)
        if(!active)return
        if(returnable)setCheck({roomId:candidate.roomId,userId:candidate.userId,offline:false})
        else useActiveGame.getState().forget(candidate.roomId,candidate.userId)
      } catch {
        if(active)setCheck({roomId:candidate.roomId,userId:candidate.userId,offline:true})
      } finally {checking=false}
    }
    const visibility=()=>{if(!document.hidden)void refresh()}
    void refresh()
    const timer=window.setInterval(()=>void refresh(),5000)
    window.addEventListener('online',visibility);document.addEventListener('visibilitychange',visibility)
    return ()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',visibility);document.removeEventListener('visibilitychange',visibility)}
  },[game,userId,loading,inGame])
  if(!game||loading||userId!==game.userId||inGame||check?.roomId!==game.roomId||check.userId!==userId)return null
  return <aside className="return-to-game" role="status" aria-label="Return to your game"><Gamepad2 size={22}/><div><strong>YOU LEFT YOUR GAME</strong><p>{check.offline?'Connection interrupted. Return to check your match.':'Your match is still running. Want to go back?'}</p><Link className="button button-small" to={`/room/${game.code}`}>RETURN TO GAME <ArrowRight size={14}/></Link></div></aside>
}
