import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Swords, X } from 'lucide-react'
import { useAuth } from '../auth/store'
import { cancelRankedQueue, enterRankedQueue, rankedQueueStatus } from './api'

type Queue = Awaited<ReturnType<typeof enterRankedQueue>>
export default function RankedPage() {
  const navigate = useNavigate(); const session = useAuth((state) => state.session)
  const [queue, setQueue] = useState<Queue | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(true); const entering = useRef(false)
  useEffect(() => {
    let active = true
    async function enter() { if (entering.current) return; entering.current = true; try { const result = await enterRankedQueue(); if (active) setQueue(result) } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'Ranked matchmaking is unavailable.') } finally { entering.current = false; if (active) setBusy(false) } }
    void enter(); return () => { active = false }
  }, [])
  useEffect(() => {
    if (queue?.status !== 'queued') return
    let active = true
    const timer = window.setInterval(() => { void rankedQueueStatus().then((result) => { if (!active) return; setQueue(result); if (result.status === 'matched' && result.room_code) navigate(`/room/${result.room_code}`) }).catch(() => undefined) }, 2000)
    return () => { active = false; window.clearInterval(timer) }
  }, [queue?.status, navigate])
  useEffect(() => { if (queue?.status === 'matched' && queue.room_code) navigate(`/room/${queue.room_code}`) }, [queue?.status, queue?.room_code, navigate])
  async function cancel() { setBusy(true); try { setQueue(await cancelRankedQueue()) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not cancel the queue.') } finally { setBusy(false) } }
  if (!session) return null
  const matched = queue?.status === 'matched'
  return <div className="container page-content ranked-page"><header className="page-heading centered"><span className="eyebrow red">COMPETITIVE / SEASON 01</span><h1>RANKED BATTLE</h1><p>Two real players. Similar ratings. The existing Battle Mode decides the result.</p></header><section className="panel ranked-card"><div className="ranked-icon"><Swords size={38}/></div><span className={`badge ${matched ? 'green' : 'yellow'}`}>{matched ? 'MATCH FOUND' : queue?.status === 'queued' ? 'SEARCHING FOR OPPONENT' : 'READY TO QUEUE'}</span><h2>{matched ? 'YOUR RIVAL IS READY' : queue?.status === 'queued' ? 'FINDING A FAIR MATCH' : 'ENTER RANKED QUEUE'}</h2><p>{matched ? 'Opening the ranked Battle lobby. Both players will start automatically.' : queue?.status === 'queued' ? 'We are searching within a rating window that expands only when needed.' : 'Ranked Battle uses independent, solver-matched boards, live inputs, energy and attacks.'}</p>{queue?.rating != null && <div className="ranked-rating"><span className="eyebrow">YOUR RATING</span><strong>{queue.rating}</strong>{queue.opponent_rating != null && <small>OPPONENT RATING · {queue.opponent_rating}</small>}</div>}{error && <p className="form-error" role="alert">{error}</p>}{queue?.status === 'queued' && <button className="button button-outline" disabled={busy} onClick={() => void cancel()}><X size={16}/> CANCEL SEARCH</button>}{queue?.status === 'cancelled' && <button className="button" disabled={busy} onClick={() => { setError(null); setBusy(true); void enterRankedQueue().then(setQueue).catch((failure) => setError(failure instanceof Error ? failure.message : 'Ranked matchmaking is unavailable.')).finally(() => setBusy(false)) }}>SEARCH AGAIN</button>}{busy && !queue && <p role="status">Connecting to ranked matchmaking…</p>}</section><p className="hint-note centered">Ranked results update ratings only after the server finishes the Battle match. Practice and private matches never affect your rating.</p><Link to="/play" className="text-link ranked-back">BACK TO MODES</Link></div>
}
