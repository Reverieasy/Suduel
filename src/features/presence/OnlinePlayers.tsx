import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase } from '../../lib/supabase'

const useOnlinePlayers=create<{count:number|null;unavailable:boolean}>(()=>({count:null,unavailable:false}))
function visitorKey() {
  try {
    let key=localStorage.getItem('suduel.presence.v1')
    if(!key){key=crypto.randomUUID();localStorage.setItem('suduel.presence.v1',key)}
    return key
  } catch {return crypto.randomUUID()}
}

export function OnlinePlayersPresence() {
  useEffect(()=> {
    if(!supabase)return
    const client=supabase
    let active=true
    const key=visitorKey()
    const channel=client.channel('suduel-online:v1',{config:{presence:{key}}})
    const sync=()=>{
      const state=channel.presenceState()
      // The initial empty snapshot can arrive before our own join is confirmed.
      if(active&&state[key]?.length)useOnlinePlayers.setState({count:Object.keys(state).length,unavailable:false})
    }
    channel.on('presence',{event:'sync'},sync).subscribe((status)=> {
      if(!active)return
      if(status==='SUBSCRIBED')void channel.track({online:true}).then(result=>{if(!active)return;if(result==='ok')sync();else useOnlinePlayers.setState({count:null,unavailable:true})}).catch(()=>{if(active)useOnlinePlayers.setState({count:null,unavailable:true})})
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')useOnlinePlayers.setState({count:null,unavailable:true})
    })
    return ()=>{active=false;void client.removeChannel(channel)}
  },[])
  return null
}

export function OnlinePlayersLabel() {
  const {count,unavailable}=useOnlinePlayers()
  return <span className="eyebrow hero-eyebrow" role="status" aria-live="polite"><i className="status-dot"/>{count!==null?`${count} ${count===1?'PLAYER':'PLAYERS'} ONLINE`:unavailable||!supabase?'ONLINE COUNT UNAVAILABLE':'CONNECTING TO PLAYERS…'}</span>
}
