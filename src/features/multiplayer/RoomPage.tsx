import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Modal } from '../../components/Modal'
import { useAuth } from '../auth/store'
import { roomCommand, startRace } from './api'
import { useRoom } from './useRoom'
import { Lobby } from './Lobby'
import { Race } from './Race'
import { Results } from './Results'

export default function RoomPage() {
  const code = (useParams().code ?? '').toUpperCase()
  const userId = useAuth((s) => s.session?.user.id ?? '')
  const navigate = useNavigate()
  const { snapshot, error, connection, offset, accept, refresh } = useRoom(code)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'leave' | 'forfeit' | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => { const interval = window.setInterval(() => setClock(Date.now()), 250); return () => window.clearInterval(interval) }, [])
  async function command(name: string, payload: Record<string, string | number | boolean> = {}) {
    if (busy) return
    setBusy(true); setActionError(null)
    const sentAt = Date.now()
    try {
      const value = await roomCommand(name, { ...payload, code })
      if (name === 'leave') navigate('/play')
      else { accept(value, sentAt); if (value.action?.message) setActionError(value.action.message) }
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'The action could not be confirmed. Refreshing…'); void refresh(); throw failure }
    finally { setBusy(false) }
  }
  async function start() {
    setBusy(true); setActionError(null)
    try { await startRace(code); await refresh() }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Could not start the match.'); void refresh() }
    finally { setBusy(false) }
  }
  // UI callbacks consume their errors here; rematch acceptance needs rejection to stop a start.
  const uiCommand: typeof command = async (...args) => { try { await command(...args) } catch { /* Feedback is rendered above the room. */ } }
  if (!snapshot) return <div className="empty-state"><span className="eyebrow blue">PRIVATE ROOM · {code}</span><h1>{error ? 'CAN’T ENTER THIS ROOM.' : 'CONNECTING…'}</h1><p role={error ? 'alert' : 'status'}>{error ?? 'Checking your invitation and loading the lobby.'}</p><button className="button" onClick={() => window.location.reload()}>TRY AGAIN</button><Link to="/rooms/new" className="text-link">Create or join another room</Link></div>
  return <div className="container page-content room-page"><header className="page-heading"><span className="eyebrow blue">{snapshot.match?.status === 'active' ? 'LIVE ARENA' : 'PRIVATE ROOM'}</span><h1>{snapshot.match ? snapshot.match.status === 'finished' ? 'MATCH RESULTS' : 'CLASSIC RACE' : 'PRIVATE MATCH'}</h1>{!snapshot.match && <p>Invite a friend, choose your settings, and start together.</p>}</header>
    <div className="room-connection"><span className={`eyebrow ${connection === 'offline' ? 'yellow' : 'green'}`}>{connection === 'live' ? 'REALTIME CONNECTED' : connection === 'polling' ? 'SYNCING BY POLL · RETRYING REALTIME' : connection === 'offline' ? 'RECONNECTING · CLOCK CONTINUES' : 'CONNECTING…'}</span><button className="quiet-button" onClick={() => void refresh()}><RefreshCw size={13} /> RESYNC</button></div>
    {(error || actionError) && <p className="form-error" role="alert">{actionError ?? error}</p>}
    {snapshot.room.status === 'closed' ? <section className="panel empty-state"><h2>THIS ROOM IS CLOSED.</h2><p>Your previous match results remain in your profile.</p><Link to="/rooms/new" className="button">NEW PRIVATE ROOM</Link></section> : snapshot.match?.status === 'finished' ? <Results snapshot={snapshot} userId={userId} busy={busy} command={command} start={start} /> : snapshot.match ? <Race key={snapshot.match.id} snapshot={snapshot} userId={userId} now={clock + offset} busy={busy} online={connection !== 'offline'} command={uiCommand} forfeit={() => setConfirm('forfeit')} /> : <Lobby snapshot={snapshot} userId={userId} now={clock + offset} busy={busy} command={uiCommand} start={start} leave={() => setConfirm('leave')} />}
    {confirm && <Modal title={confirm === 'forfeit' ? 'LEAVE THE RACE?' : 'LEAVE THIS ROOM?'} onClose={() => setConfirm(null)}><p>{confirm === 'forfeit' ? 'Forfeiting ends this match and awards the win to your opponent. Temporary disconnections get a grace period instead.' : snapshot.room.host_id === userId ? 'As host, leaving will close this room.' : 'Your seat will become available to another player.'}</p><div className="modal-actions"><button className="button button-outline" onClick={() => setConfirm(null)}>STAY HERE</button><button className="button button-red" disabled={busy} onClick={() => { void uiCommand(confirm); setConfirm(null) }}>{confirm === 'forfeit' ? 'FORFEIT' : 'LEAVE ROOM'}</button></div></Modal>}
  </div>
}
