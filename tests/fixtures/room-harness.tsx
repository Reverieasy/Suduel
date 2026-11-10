// Presentation fixtures only. Not an application route, authenticated match, or build entry.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import RoomPage from '../../src/features/multiplayer/RoomPage'
import { useAuth } from '../../src/features/auth/store'
import { Shell } from '../../src/app/Shell'
import { Lobby } from '../../src/features/multiplayer/Lobby'
import { Race } from '../../src/features/multiplayer/Race'
import { Results } from '../../src/features/multiplayer/Results'
import { Intermission } from '../../src/features/battle/Intermission'
import { AudioSettings } from '../../src/features/audio/AudioSettings'
import { AudioSystem } from '../../src/features/audio/AudioSystem'
import { useBattleFeedback } from '../../src/features/battle/useBattleFeedback'
import CreateRoom from '../../src/features/multiplayer/CreateRoom'
import { DEFAULT_BATTLE_RULES, type Skill } from '../../src/features/battle/rules'
import type { RoomSnapshot } from '../../src/features/multiplayer/types'
import '../../src/styles/index.css'
import '../../src/styles/battle.css'

const now = Date.now(), userId = crypto.randomUUID(), rivalId = crypto.randomUUID(), roomId = crypto.randomUUID(), matchId = crypto.randomUUID(), seriesId = crypto.randomUUID()
const query = new URLSearchParams(window.location.search), view = query.get('view') ?? 'race'
const isBattle = !['race','setup','lobby','results'].includes(view)
const solution = Array.from({ length: 81 }, (_, i) => (Math.floor(i/9)*3+Math.floor(i/27)+i%9)%9+1)
const clues = solution.map((n,i) => i % 3 ? n : 0)
const initial: RoomSnapshot = {
  server_now: new Date(now).toISOString(), cursor: 1, events: [],
  room: { id: roomId, mode: isBattle ? 'battle' : 'classic', code: 'A1B2C3D4', host_id: userId, difficulty: 'easy', time_limit: 300, status: 'playing', current_match_id: matchId, created_at: new Date(now).toISOString(), expires_at: new Date(now + 7200000).toISOString() },
  players: [userId, rivalId].map((id, index) => ({ user_id: id, seat: index + 1, ready: true, last_seen: new Date(now).toISOString(), username: index ? 'Challenger_1234567890' : 'GridMaster_123456789', display_name: index ? 'A Very Determined Challenger' : 'A Very Determined Solver', avatar_url: null })),
  match: { id: matchId, room_id: roomId, clues, difficulty: 'easy', mode: isBattle ? 'battle' : 'classic', series_id: isBattle ? seriesId : null, round_number: 1, battle_rules: isBattle ? DEFAULT_BATTLE_RULES : null, status: 'active', started_at: new Date(now - 1000).toISOString(), ends_at: new Date(now + Number(query.get('remaining') ?? 299000)).toISOString(), completed_at: null, winner_id: null, outcome: null, previous_match_id: null },
  progress: [userId, rivalId].map((id) => ({ match_id: matchId, user_id: id, correct_cells: 0, mistakes: 0, completed_at: null, rematch: 'none' })),
  board: { entries: [...clues], version: 0 }, battle: null,
}
function effect(skill: Skill, duration: number) {
  return { id: crypto.randomUUID(), match_id: matchId, source_id: rivalId, target_id: userId, skill, starts_at: new Date(now).toISOString(), expires_at: new Date(now+duration).toISOString(), consumed_at: null, region: skill === 'fog' ? 4 : null, keypad: skill === 'scramble' ? [9,8,7,6,5,4,3,2,1] : null }
}
if (isBattle) initial.battle = {
  series: { id: seriesId, room_id: roomId, status: 'active', winner_id: null, outcome: null, created_at: new Date(now).toISOString(), completed_at: null, rules: DEFAULT_BATTLE_RULES },
  score: [userId, rivalId].map((id) => ({ series_id: seriesId, user_id: id, rounds_won: 0 })),
  players: [userId,rivalId].map((id) => ({ user_id: id, match_id: matchId, energy: 5, version: 0, cooldown_until: null, freeze_immunity_until: null, energy_generated: 5, energy_stored: 5, skills_cast: 0, attacks_blocked: 0 })), effects: [],
}
if (['fog','freeze','scramble','shield'].includes(view)) initial.battle!.effects = [effect(view as Skill, Number(query.get('ttl') ?? 5000))]
if (view === 'results' || view === 'battle-results' || view === 'intermission') {
  initial.match!.status = 'finished'; initial.match!.winner_id = userId; initial.match!.completed_at = new Date(now).toISOString(); initial.match!.outcome = 'solved'
  if (initial.battle) { initial.battle.score[0].rounds_won = view === 'intermission' ? 1 : 2; initial.battle.series.status = view === 'intermission' ? 'active' : 'finished'; initial.battle.series.winner_id = view === 'intermission' ? null : userId }
}
Object.assign(window, { __suduelFixtureSnapshot: initial })
if (view === 'room-page') useAuth.setState({ session: { user: { id: userId } } as Session, loading: false })
const noop = async () => {}
export function Harness() {
  const [s, setSnapshot] = useState(initial), [clock, setClock] = useState(now), [settings, setSettings] = useState(false), [last, setLast] = useState('')
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()),100); return () => window.clearInterval(timer) }, [])
  useBattleFeedback(s,userId)
  async function command(name: string, payload?: Record<string, string | number | boolean>) { setLast(JSON.stringify({ name, ...payload })) }
  function cue(kind: string, payload: Record<string,unknown>) { setSnapshot((old) => ({ ...old, cursor: old.cursor+1, server_now: new Date().toISOString(), events: [...(old.events ?? []), { sequence: old.cursor+1, match_id: matchId, kind, created_at: new Date().toISOString(), payload }] })) }
  return <><AudioSystem /><div className="container"><p>UI TEST FIXTURE / NO NETWORK GAMEPLAY</p><button onClick={() => setSettings(true)}>Fixture sound settings</button><button onClick={() => cue('cast',{ actor_id: rivalId, target_id: userId, skill: 'fog', cost: 1, blocked: false })}>Fixture incoming hit</button><button onClick={() => cue('cast',{ actor_id: userId, target_id: rivalId, skill: 'freeze', cost: 2, blocked: false })}>Fixture accepted cast</button><button onClick={() => cue('energy',{ actor_id: userId, units: [{ kind: 'row', index: 0, reward: 1 },{ kind: 'box', index: 0, reward: 2 }], generated: 3, stored: 3, combo: 2 })}>Fixture combo</button><button onClick={() => setSnapshot((old) => ({ ...old, action: { id: crypto.randomUUID(), cell: 0, rejected: true } }))}>Fixture wrong number</button><output data-testid="last-command">{last}</output></div>
    <main className="container page-content">{view === 'lobby' ? <Lobby snapshot={s} userId={userId} now={clock} busy={false} command={command} start={noop} leave={() => {}} /> : view.endsWith('results') ? <Results snapshot={s} userId={userId} busy={false} command={command} start={noop} /> : view === 'intermission' ? <Intermission snapshot={s} userId={userId} busy={false} command={command} start={noop} /> : view === 'setup' ? <CreateRoom /> : <Race snapshot={s} userId={userId} now={clock} busy={false} online command={command} forfeit={() => {}} />}</main>
    {settings && <AudioSettings onClose={() => setSettings(false)} />}</>
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={view === 'room-page' ? ['/room/A1B2C3D4'] : ['/']}>
  {view === 'room-page' ? <Routes><Route element={<Shell />}><Route path="/room/:code" element={<RoomPage />} /></Route></Routes> : <Harness />}
</MemoryRouter>)
