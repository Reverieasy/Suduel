import { useEffect } from 'react'
import { audioManager } from '../audio/manager'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { formatTime } from '../sudoku/game'
import { progressPercent, type RoomSnapshot } from './types'

interface Props { snapshot: RoomSnapshot; userId: string; busy: boolean; command: (name: string, payload?: Record<string, string | number | boolean>) => Promise<void>; start: () => Promise<void> }
export function Results({ snapshot: s, userId, busy, command, start }: Props) {
  const match = s.match!, own = s.progress.find((p) => p.user_id === userId)!, other = s.progress.find((p) => p.user_id !== userId)!
  const outcome = s.battle?.series.outcome ?? match.outcome
  const winner = s.battle ? s.battle.series.winner_id : match.winner_id
  const won = winner === userId, draw = !winner
  useEffect(() => {
    audioManager.play('round_end', `round-end:${match.id}`)
    audioManager.play(draw ? 'draw' : won ? 'victory' : 'defeat', `result:${s.battle?.series.id ?? match.id}`)
  }, [match.id, s.battle?.series.id, won, draw])
  const canStart = s.progress.every((p) => ['requested', 'accepted'].includes(p.rematch))
  async function accept() { try { await command('rematch_accept', { match_id: match.id }); await start() } catch { /* The room displays command failures. */ } }
  const request: typeof command = async (...args) => { try { await command(...args) } catch { /* The room displays command failures. */ } }
  return <section className="race-results"><span className="eyebrow">MATCH COMPLETE / {s.battle ? 'BATTLE SERIES' : 'CLASSIC RACE'}</span><img src="/figma/victory.svg" width="90" height="90" alt="" /><h1 className={draw ? 'blue' : won ? 'yellow' : 'red'}>{draw ? 'A MATCHED MIND.' : won ? 'YOU WIN!' : 'NEXT TIME IS YOURS.'}</h1><p>{outcome === 'solved' ? 'The first complete solution was verified by the server.' : outcome === 'timeout' ? 'Time is up. The server compared confirmed progress.' : outcome === 'forfeit' ? 'This match ended by forfeit.' : 'This match ended after the connection grace period.'}</p>
    <div className="round-score result-score">{s.battle?.score.map((p) => <span key={p.user_id}>{s.players.find((player) => player.user_id === p.user_id)?.username} <b>{p.rounds_won}</b></span>)}</div>{outcome === 'timeout' && <strong className="yellow">TIME’S UP!</strong>}<div className="result-player-grid">{s.players.map((player) => {
      const result = s.progress.find((p) => p.user_id === player.user_id)!
      const elapsed = Math.min(Date.parse(result.completed_at ?? match.completed_at!), Date.parse(match.ends_at)) - Date.parse(match.started_at)
      return <article className="panel result-player" key={player.user_id}><div className="race-player-heading"><Avatar name={player.username} url={player.avatar_url} opponent={player.user_id !== userId} /><h2>{player.display_name}</h2><span className="badge">{draw ? 'DRAW' : winner === player.user_id ? 'WINNER' : 'RUNNER-UP'}</span></div><dl><div><dt>{result.completed_at ? 'FINISH TIME' : 'TIME PLAYED'}</dt><dd>{formatTime(Math.max(0, elapsed))}</dd></div><div><dt>CORRECT CELLS</dt><dd>{result.correct_cells}</dd></div><div><dt>PROGRESS</dt><dd>{progressPercent(result.correct_cells, match.clues)}%</dd></div><div><dt>MISTAKES</dt><dd>{result.mistakes}</dd></div>{s.battle && <><div><dt>SKILLS / FINAL ROUND</dt><dd>{s.battle.players.find((p) => p.user_id === player.user_id)?.skills_cast}</dd></div><div><dt>ENERGY GENERATED</dt><dd>{s.battle.players.find((p) => p.user_id === player.user_id)?.energy_generated}</dd></div></>}</dl></article>
    })}</div>
    <div className="rematch-panel panel"><h2>{s.battle ? 'ANOTHER SERIES?' : 'ONE MORE ROUND?'}</h2>{other.rematch === 'requested' && own.rematch === 'none' ? <><p>Your opponent requested a rematch.</p><div className="modal-actions"><button className="button button-outline" disabled={busy} onClick={() => void request('rematch_decline', { match_id: match.id })}>DECLINE</button><button className="button" disabled={busy} onClick={() => void accept()}>ACCEPT REMATCH</button></div></> : canStart ? <><p>Both players agreed. Start a fresh synchronized puzzle.</p><button className="button" disabled={busy} onClick={() => void start()}>START REMATCH</button></> : own.rematch === 'requested' ? <p role="status">Rematch requested. Waiting for your opponent…</p> : <><p>{other.rematch === 'declined' || own.rematch === 'declined' ? 'The rematch was declined. You can send another request.' : 'Fresh puzzle. Fresh clock. Previous results stay saved.'}</p><button className="button" disabled={busy} onClick={() => void request('rematch_request', { match_id: match.id })}>REQUEST REMATCH</button></>}</div><div className="result-links"><Link to="/play" className="button button-outline">BACK TO MODES</Link><Link to="/profile" className="text-link">Your profile & match history</Link></div>
  </section>
}
