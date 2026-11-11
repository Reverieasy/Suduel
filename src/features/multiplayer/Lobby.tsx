import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Copy, Check, Play, LogOut } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { appUrl } from '../../lib/supabase'
import type { RoomSnapshot } from './types'

interface Props { snapshot: RoomSnapshot; userId: string; now: number; busy: boolean; command: (name: string, payload?: Record<string, string | number | boolean>) => Promise<void>; start: () => Promise<void>; leave: () => void }
export function Lobby({ snapshot: s, userId, now, busy, command, start, leave }: Props) {
  const [copyState, setCopyState] = useState('COPY INVITE LINK')
  const host = s.room.host_id === userId
  const me = s.players.find((p) => p.user_id === userId)!
  const allReady = s.players.length === 2 && s.players.every((p) => p.ready && now - Date.parse(p.last_seen) < 15000)
  const ranked = Boolean((s.room as typeof s.room & { ranked?: boolean }).ranked)
  const startAttempted = useRef(false)
  useEffect(() => { if (ranked && host && allReady && !busy && !startAttempted.current) { startAttempted.current = true; void start() } }, [ranked, host, allReady, busy, start])
  async function copy() {
    try { await navigator.clipboard.writeText(appUrl(`/room/${s.room.code}`)); setCopyState('COPIED!') }
    catch { setCopyState('SELECT AND COPY THE LINK BELOW') }
  }
  async function settings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    await command('settings', { mode: String(fields.get('mode')), difficulty: String(fields.get('difficulty')), time_limit: Number(fields.get('time_limit')) })
  }
  return <><div className="lobby-toolbar"><span className="badge yellow">ROOM · {s.room.code}</span><button className="button button-small" onClick={() => void copy()}><Copy size={16} />{copyState}</button></div>
    <input className="invite-link" aria-label="Invitation link" readOnly value={appUrl(`/room/${s.room.code}`)} onFocus={(e) => e.currentTarget.select()} />
    <div className="lobby-grid"><section className="panel lobby-players"><div className="section-heading"><h2>PLAYERS / {s.players.length} OF 2</h2><span className="eyebrow">{ranked ? 'RANKED MATCH' : 'PRIVATE ROOM'}</span></div>
      {s.players.map((player) => <article key={player.user_id} className="lobby-player"><Avatar name={player.username} url={player.avatar_url} opponent={player.user_id !== userId} /><div><h3>{player.display_name} {player.user_id === userId && <small>YOU</small>}</h3><p>@{player.username} · {player.user_id === s.room.host_id ? 'HOST' : 'CHALLENGER'}</p><span className={`eyebrow ${now - Date.parse(player.last_seen) < 15000 ? 'green' : 'yellow'}`}>{now - Date.parse(player.last_seen) < 15000 ? 'CONNECTED' : 'AWAITING CONNECTION'}</span></div><span className={`badge ${player.ready ? 'green' : ''}`}>{player.ready ? <Check size={12} /> : null}{player.ready ? 'READY' : 'NOT READY'}</span></article>)}
      {s.players.length < 2 && <div className="waiting-player"><span>2P</span><p>Your rival’s seat is open.<br />Share the invitation link to get started.</p></div>}
      <div className="lobby-buttons"><button className="button button-outline" disabled={busy} onClick={() => void command('ready', { ready: !me.ready })}>{me.ready ? 'NOT READY' : 'I’M READY'}</button>{host ? <button className="button button-gold" disabled={busy || !allReady} onClick={() => void start()}><Play size={16} />{busy ? 'PLEASE WAIT…' : 'START MATCH'}</button> : <p>Once both players are ready, the host can start.</p>}</div><button className="quiet-button" onClick={leave} disabled={busy}><LogOut size={14} /> LEAVE ROOM</button>
    </section><section className="panel room-settings"><h2>MATCH SETTINGS</h2><p>{s.room.mode === 'battle' ? 'Battle / best of three' : 'Classic Race / one round'} / standard 9×9.<br />Changing settings clears both ready states.</p><form onSubmit={settings}><fieldset className="auth-fields" disabled={!host || busy}><label>MODE<select name="mode" key={s.room.mode} defaultValue={s.room.mode}><option value="classic">Classic Race</option><option value="battle">Battle / best of three</option></select></label><label>DIFFICULTY<select name="difficulty" key={s.room.difficulty} defaultValue={s.room.difficulty}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label>TIME LIMIT<select name="time_limit" key={s.room.time_limit} defaultValue={s.room.time_limit}><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option></select></label>{host && <button className="button button-outline" type="submit">SAVE SETTINGS</button>}</fieldset></form><p className="hint-note">{s.room.mode === 'battle' ? 'First to two round wins takes the series. Complete units for energy. Drawn rounds replay with a fresh puzzle. A forfeit ends the series.' : 'First verified solution wins.'} At timeout, most correct entries wins; equal progress is a draw. A lost connection has a 30-second grace period after detection.</p></section></div></>
}
