import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Modal } from '../../components/Modal'
import { useAuth } from '../auth/store'
import { roomCommand, startRace } from './api'
import { useRoom } from './useRoom'
import { Lobby } from './Lobby'
import { Race } from './Race'
import { Results } from './Results'
import { useBattleFeedback } from '../battle/useBattleFeedback'
import { Intermission } from '../battle/Intermission'
import { MatchMenu } from '../battle/MatchMenu'
import { SkillGuide } from '../battle/BattleHud'
import { AudioSettings } from '../audio/AudioSettings'

export default function RoomPage() {
  const code = (useParams().code ?? '').toUpperCase()
  const userId = useAuth((s) => s.session?.user.id ?? '')
  const navigate = useNavigate()
  const { snapshot, error, connection, offset, accept, refresh } = useRoom(code)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'leave' | 'forfeit' | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const inFlight = useRef(false)
  const [menu, setMenu] = useState<'menu' | 'guide' | 'sound' | null>(null)
  const consumeReply = useBattleFeedback(snapshot, userId)
  useEffect(() => { const interval = window.setInterval(() => setClock(Date.now()), 250); return () => window.clearInterval(interval) }, [])
  const command = useCallback(async (name: string, payload: Record<string, string | number | boolean> = {}) => {
    if (inFlight.current) throw new Error('An action is still being confirmed.')
    inFlight.current = true
    setBusy(true); setActionError(null)
    const sentAt = Date.now()
    try {
      const value = await roomCommand(name, { ...payload, code })
      // An RPC acknowledgement may arrive after a newer Realtime snapshot.
      // Its private action feedback is still valid even when its board is stale.
      consumeReply(value)
      if (name === 'leave') navigate('/play')
      else { accept(value, sentAt); if (value.action?.message) setActionError(value.action.message) }
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'The action could not be confirmed. Refreshing…'); void refresh(); throw failure }
    finally { inFlight.current = false; setBusy(false) }
  }, [code, navigate, accept, refresh, consumeReply])
  async function start() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setActionError(null)
    try { await startRace(code); await refresh() }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Could not start the match.'); void refresh() }
    finally { inFlight.current = false; setBusy(false) }
  }
  // UI callbacks consume their errors here; rematch acceptance needs rejection to stop a start.
  const uiCommand = useCallback<typeof command>(async (...args) => { try { await command(...args) } catch { /* Feedback is rendered above the room. */ } }, [command])
  if (!snapshot) return <div className="empty-state"><span className="eyebrow blue">PRIVATE ROOM · {code}</span><h1>{error ? 'CAN’T ENTER THIS ROOM.' : 'CONNECTING…'}</h1><p role={error ? 'alert' : 'status'}>{error ?? 'Checking your invitation and loading the lobby.'}</p><button className="button" onClick={() => window.location.reload()}>TRY AGAIN</button><Link to="/rooms/new" className="text-link">Create or join another room</Link></div>
  return <div className="container page-content room-page"><header className="page-heading"><span className="eyebrow blue">{snapshot.match?.status === 'active' ? 'LIVE ARENA' : 'PRIVATE ROOM'}</span><h1>{snapshot.match ? snapshot.match.status === 'finished' ? (snapshot.battle?.series.status === 'active' ? 'ROUND RESULTS' : 'MATCH RESULTS') : (snapshot.battle ? 'BATTLE MODE' : 'CLASSIC RACE') : 'PRIVATE MATCH'}</h1>{!snapshot.match && <p>Invite a friend, choose your settings, and start together.</p>}<button className="button button-small button-outline match-menu-trigger" onClick={() => setMenu('menu')}>MATCH MENU</button></header>
    <div className="room-connection"><span className={`eyebrow ${connection === 'offline' ? 'yellow' : 'green'}`}>{connection === 'live' ? 'REALTIME CONNECTED' : connection === 'polling' ? 'SYNCING BY POLL · RETRYING REALTIME' : connection === 'offline' ? 'RECONNECTING · CLOCK CONTINUES' : 'CONNECTING…'}</span><button className="quiet-button" onClick={() => void refresh()}><RefreshCw size={13} /> RESYNC</button></div>
    {(error || actionError) && <p className="form-error" role="alert">{actionError ?? error}</p>}
    {snapshot.room.status === 'closed' ? <section className="panel empty-state"><h2>THIS ROOM IS CLOSED.</h2><p>Your previous match results remain in your profile.</p><Link to="/rooms/new" className="button">NEW PRIVATE ROOM</Link></section> : snapshot.match?.status === 'finished' ? snapshot.battle?.series.status === 'active' ? <Intermission snapshot={snapshot} userId={userId} busy={busy} command={uiCommand} start={start} /> : <Results snapshot={snapshot} userId={userId} busy={busy} command={command} start={start} /> : snapshot.match ? <Race key={snapshot.match.id} snapshot={snapshot} userId={userId} now={clock + offset} busy={busy} online={connection !== 'offline'} command={uiCommand} forfeit={() => setConfirm('forfeit')} /> : <Lobby snapshot={snapshot} userId={userId} now={clock + offset} busy={busy} command={uiCommand} start={start} leave={() => setConfirm('leave')} />}
    {menu === 'menu' && <MatchMenu onClose={() => setMenu(null)} onGuide={() => setMenu('guide')} onSound={() => setMenu('sound')} onForfeit={() => { setMenu(null); setConfirm('forfeit') }} active={snapshot.match?.status === 'active' || snapshot.battle?.series.status === 'active'} />}
    {menu === 'guide' && <SkillGuide snapshot={snapshot} onClose={() => setMenu(null)} />}
    {menu === 'sound' && <AudioSettings onClose={() => setMenu(null)} />}
    {confirm && <Modal title={confirm === 'forfeit' ? 'LEAVE THE RACE?' : 'LEAVE THIS ROOM?'} onClose={() => setConfirm(null)}><p>{confirm === 'forfeit' ? 'Forfeiting awards the match to your opponent, including the full series in Battle. Temporary disconnections get a grace period instead.' : snapshot.room.host_id === userId ? 'As host, leaving will close this room.' : 'Your seat will become available to another player.'}</p><div className="modal-actions"><button className="button button-outline" onClick={() => setConfirm(null)}>STAY HERE</button><button className="button button-red" disabled={busy} onClick={() => { void uiCommand(confirm, confirm === 'forfeit' && snapshot.match ? { match_id: snapshot.match.id } : {}); setConfirm(null) }}>{confirm === 'forfeit' ? 'FORFEIT' : 'LEAVE ROOM'}</button></div></Modal>}
  </div>
}
