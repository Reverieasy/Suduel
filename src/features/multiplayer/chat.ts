import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export interface ChatMessage { id: number; room_id: string; user_id: string; body: string; created_at: string }
function client() {
  if (!supabase) throw new Error('Multiplayer is unavailable.')
  return supabase as unknown as SupabaseClient
}
export async function loadChat(room: string): Promise<ChatMessage[]> {
  const {data,error}=await client().from('room_chat_messages').select('id,room_id,user_id,body,created_at').eq('room_id',room).order('id',{ascending:false}).limit(50).overrideTypes<ChatMessage[],{merge:false}>()
  if(error)throw error
  return (data??[]).reverse()
}
export async function sendChat(room: string, body: string, actionId: string): Promise<ChatMessage> {
  const {data,error}=await client().rpc('send_room_chat',{p_room:room,p_body:body,p_action_id:actionId})
  if(error)throw error
  if(!data||!Number.isSafeInteger(data.id)||typeof data.room_id!=='string'||typeof data.user_id!=='string'||typeof data.body!=='string'||typeof data.created_at!=='string')throw new Error('Message confirmation was invalid. Try again.')
  return data as ChatMessage
}
