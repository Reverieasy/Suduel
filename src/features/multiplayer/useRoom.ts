import { useCallback, useEffect, useRef, useState } from 'react'
import { requireBackend } from '../../lib/supabase'
import { roomCommand } from './api'
import type { RoomSnapshot } from './types'

export function useRoom(code: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling' | 'offline'>('connecting')
  const [offset, setOffset] = useState(0)
  const mounted = useRef(false)
  const refreshing = useRef(false)
  const refreshAgain = useRef(false)
  const realtimeReady = useRef(false)
  const currentCode = useRef(code)
  const latest = useRef({ code: '', cursor: -1, time: 0 })
  useEffect(() => { currentCode.current = code }, [code])
  const accept = useCallback((value: RoomSnapshot, sentAt = Date.now()) => {
    if (!mounted.current || value.room.code !== currentCode.current) return
    const serverTime = Date.parse(value.server_now)
    if (latest.current.code === value.room.code && (value.cursor < latest.current.cursor || serverTime < latest.current.time)) return
    latest.current = { code: value.room.code, cursor: value.cursor, time: serverTime }
    setSnapshot(value)
    setOffset(Date.parse(value.server_now) - (sentAt + Date.now()) / 2)
    setError(null)
    setConnection(realtimeReady.current ? 'live' : 'polling')
  }, [])
  const refresh = useCallback(async () => {
    if (refreshing.current) { refreshAgain.current = true; return }
    refreshing.current = true
    try {
      do {
        refreshAgain.current = false
        const sent = Date.now()
        try { accept(await roomCommand('snapshot', { code }), sent) }
        catch (failure) { if (mounted.current) { setError(failure instanceof Error ? failure.message : 'Connection interrupted. Retrying…'); setConnection('offline') } }
      } while (refreshAgain.current && mounted.current)
    } finally { refreshing.current = false }
  }, [code, accept])
  useEffect(() => {
    mounted.current = true
    let disposed = false
    const started = Date.now()
    void roomCommand('join', { code }).then((value) => { if (!disposed) accept(value, started) }).catch((failure) => { if (!disposed) setError(failure instanceof Error ? failure.message : 'Could not join this room.') })
    const online = () => { void refresh() }
    const offline = () => setConnection('offline')
    const visibility = () => { if (!document.hidden) void refresh() }
    window.addEventListener('online', online); window.addEventListener('offline', offline); document.addEventListener('visibilitychange', visibility)
    return () => { disposed = true; mounted.current = false; window.removeEventListener('online', online); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visibility) }
  }, [code, accept, refresh])
  const battleActive = snapshot?.match?.mode === 'battle' && snapshot.match.status === 'active'
  useEffect(() => {
    // Short skills need faster recovery snapshots while Realtime reconnects.
    const period = battleActive && connection === 'polling' ? 500 : connection === 'offline' ? 2000 : 5000
    const timer = window.setInterval(() => { if (navigator.onLine) void refresh() }, period)
    return () => window.clearInterval(timer)
  }, [battleActive, connection, refresh])
  const roomId = snapshot?.room.id
  useEffect(() => {
    if (!roomId) return
    const client = requireBackend()
    const channel = client.channel(`room-events:${roomId}:${crypto.randomUUID()}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_events', filter: `room_id=eq.${roomId}` }, () => void refresh()).subscribe((status) => {
      realtimeReady.current = status === 'SUBSCRIBED'
      if (status === 'SUBSCRIBED') { setConnection('live'); void refresh() }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setConnection(navigator.onLine ? 'polling' : 'offline'); void refresh() }
    })
    return () => { realtimeReady.current = false; void client.removeChannel(channel) }
  }, [roomId, refresh])
  return { snapshot, error, connection, offset, accept, refresh }
}
