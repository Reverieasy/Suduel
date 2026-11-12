import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, Send, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { loadChat, sendChat, type ChatMessage } from './chat'
import type { RoomPlayer } from './types'

export function RoomChat({roomId,userId,players,online}: {roomId:string;userId:string;players:RoomPlayer[];online:boolean}) {
  const [open,setOpen]=useState(false), [messages,setMessages]=useState<ChatMessage[]>([]), [draft,setDraft]=useState(''), [error,setError]=useState(''), [sending,setSending]=useState(false)
  const [unread,setUnread]=useState(false), [preview,setPreview]=useState<ChatMessage|null>(null)
  const trigger=useRef<HTMLButtonElement>(null), input=useRef<HTMLTextAreaElement>(null), list=useRef<HTMLDivElement>(null), pending=useRef<{body:string;id:string}|null>(null), sendingRef=useRef(false)
  const isOpen=useRef(false)
  function merge(incoming:ChatMessage[]) {setMessages(current=>Array.from(new Map([...current,...incoming].map(message=>[message.id,message])).values()).sort((a,b)=>a.id-b.id).slice(-50))}
  useEffect(()=>{
    let active=true, loading=false, initialized=false, refreshAgain=false
    const seen=new Set<number>()
    async function refresh() {
      if(loading){refreshAgain=true;return}
      loading=true
      try {
        const data=await loadChat(roomId)
        if(active){
          const incoming=data.filter(message=>message.room_id===roomId&&!seen.has(message.id)&&message.user_id!==userId)
          for(const message of data)seen.add(message.id)
          // Existing history establishes the baseline; reconnect/poll duplicates never notify.
          if(initialized&&!isOpen.current&&incoming.length){
            setUnread(true)
            setPreview(incoming.at(-1)!)
          }
          initialized=true
          merge(data);setError('')
        }
      }
      catch {if(active)setError('Chat could not sync. Retrying…')}
      finally {loading=false;if(active&&refreshAgain){refreshAgain=false;void refresh()}}
    }
    void refresh()
    const channel=supabase?.channel(`room-chat:${roomId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'room_chat_messages',filter:`room_id=eq.${roomId}`},()=>void refresh()).subscribe(status=>{if(status==='SUBSCRIBED')void refresh()})
    const timer=window.setInterval(()=>void refresh(),3000)
    return ()=>{active=false;window.clearInterval(timer);if(channel)void supabase?.removeChannel(channel)}
  },[roomId,userId])
  useEffect(()=>{if(open)input.current?.focus()},[open])
  useEffect(()=>{
    if(!preview)return
    const timer=window.setTimeout(()=>setPreview(null),5000)
    return ()=>window.clearTimeout(timer)
  },[preview])
  useEffect(()=>{list.current?.scrollTo({top:list.current.scrollHeight})},[messages,open])
  function show() {isOpen.current=true;setOpen(true);setUnread(false);setPreview(null)}
  function close() {isOpen.current=false;setOpen(false);trigger.current?.focus()}
  async function send() {
    const body=draft.trim()
    if(!body||!online||sendingRef.current)return
    sendingRef.current=true;setSending(true);setError('')
    const request=pending.current?.body===body?pending.current:{body,id:crypto.randomUUID()}
    pending.current=request
    try {const message=await sendChat(roomId,body,request.id);merge([message]);setDraft('');pending.current=null}
    catch(failure) {setError(failure instanceof Error?failure.message:typeof failure==='object'&&failure&&'message' in failure?String(failure.message):'Message could not be sent. Try again.')}
    finally {sendingRef.current=false;setSending(false);input.current?.focus()}
  }
  return <><button ref={trigger} className="icon-button room-chat-trigger" aria-label="Opponent chat" aria-expanded={open} aria-describedby={unread?`chat-unread-${roomId}`:undefined} onClick={()=>open?close():show()}><MessageCircle size={17}/>{unread&&<><span className="chat-unread-dot" aria-hidden="true"/><span id={`chat-unread-${roomId}`} className="sr-only">Unread messages</span></>}</button>{!open&&preview&&createPortal(<aside className="chat-preview" role="status" aria-live="polite" aria-atomic="true">
    <button className="chat-preview-message" aria-label="Open unread opponent message" onClick={show}><strong>@{players.find(player=>player.user_id===preview.user_id)?.username??'Opponent'}</strong><p>{preview.body}</p><small>Click to open chat</small></button><button className="icon-button chat-preview-dismiss" aria-label="Dismiss message preview" onClick={()=>setPreview(null)}><X size={14}/></button>
  </aside>,document.body)}{open&&createPortal(<section className="room-chat" role="dialog" aria-label="Opponent chat" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close()}}}>
    <header><div><strong>OPPONENT CHAT</strong><small>Only players in this room</small></div><button className="icon-button" aria-label="Close chat" onClick={close}><X size={17}/></button></header>
    <div className="room-chat-messages" ref={list} role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">{messages.length?messages.map(message=><div className={`chat-message${message.user_id===userId?' chat-own':''}`} key={message.id}><strong>{message.user_id===userId?'You':`@${players.find(player=>player.user_id===message.user_id)?.username??'Opponent'}`}</strong><p>{message.body}</p></div>):<p className="chat-empty">Say hello to your opponent.</p>}</div>
    {(!online||error)&&<p className="chat-error" role="status">{!online?'Reconnecting. Your draft is saved.':error}</p>}
    <form onSubmit={event=>{event.preventDefault();void send()}}><label className="sr-only" htmlFor={`chat-${roomId}`}>Message your opponent</label><textarea id={`chat-${roomId}`} ref={input} value={draft} maxLength={300} rows={2} placeholder="Good luck, solver!" onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send()}}}/><div><small>{draft.length}/300 · Enter to send</small><button className="button button-small" aria-label="Send message" disabled={!draft.trim()||sending||!online}><Send size={14}/>{sending?'SENDING':'SEND'}</button></div></form>
  </section>,document.body)}</>
}
