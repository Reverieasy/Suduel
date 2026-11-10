// UI regression fixtures only. This file is not an application route or build entry.
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { Lobby } from '../../src/features/multiplayer/Lobby'
import { Race } from '../../src/features/multiplayer/Race'
import { Results } from '../../src/features/multiplayer/Results'
import CreateRoom from '../../src/features/multiplayer/CreateRoom'
import { generatePuzzle } from '../../src/features/sudoku/engine'
import type { RoomSnapshot } from '../../src/features/multiplayer/types'
import '../../src/styles/index.css'

const now = Date.now(), userId = crypto.randomUUID(), rivalId = crypto.randomUUID(), roomId = crypto.randomUUID(), matchId = crypto.randomUUID()
const s: RoomSnapshot = {
  server_now: new Date(now).toISOString(), cursor: 1,
  room: { id: roomId, code: 'A1B2C3D4', host_id: userId, difficulty: 'easy', time_limit: 300, status: 'playing', current_match_id: matchId, created_at: new Date(now).toISOString(), expires_at: new Date(now + 7200000).toISOString() },
  players: [userId, rivalId].map((id, index) => ({ user_id: id, seat: index + 1, ready: true, last_seen: new Date(now).toISOString(), username: index ? 'Challenger_1234567890' : 'GridMaster_123456789', display_name: index ? 'A Very Determined Challenger' : 'A Very Determined Solver', avatar_url: null })),
  match: { id: matchId, room_id: roomId, clues: generatePuzzle('easy').clues, difficulty: 'easy', status: 'active', started_at: new Date(now - 1000).toISOString(), ends_at: new Date(now + 299000).toISOString(), completed_at: null, winner_id: null, outcome: null, previous_match_id: null },
  progress: [userId, rivalId].map((id) => ({ match_id: matchId, user_id: id, correct_cells: 0, mistakes: 0, completed_at: null, rematch: 'none' })),
  board: { entries: [], version: 0 },
}
s.board!.entries = [...s.match!.clues]
const view = new URLSearchParams(window.location.search).get('view')
if (view === 'results') { s.match!.status = 'finished'; s.match!.winner_id = userId; s.match!.completed_at = new Date(now).toISOString(); s.match!.outcome = 'solved' }
const noop = async () => {}
createRoot(document.getElementById('root')!).render(<MemoryRouter><main className="container page-content">
  {view === 'lobby' ? <Lobby snapshot={s} userId={userId} now={now} busy={false} command={noop} start={noop} leave={() => {}} /> : view === 'results' ? <Results snapshot={s} userId={userId} busy={false} command={noop} start={noop} /> : view === 'setup' ? <CreateRoom /> : <Race snapshot={s} userId={userId} now={now} busy={false} online command={noop} forfeit={() => {}} />}
</main></MemoryRouter>)
