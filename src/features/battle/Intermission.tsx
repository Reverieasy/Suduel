import { useEffect } from 'react'
import type { RoomSnapshot } from '../multiplayer/types'
import { audioManager } from '../audio/manager'

export function Intermission({ snapshot: s, userId, busy, command, start }: { snapshot: RoomSnapshot; userId: string; busy: boolean; command: (name: string, payload?: Record<string, string | number | boolean>) => Promise<void>; start: () => Promise<void> }) {
  const match = s.match!, won = match.winner_id === userId, draw = !match.winner_id
  const ready = s.progress.find((p) => p.user_id === userId)?.rematch === 'accepted'
  const both = s.progress.every((p) => p.rematch === 'accepted')
  useEffect(() => { audioManager.play('round_end', `round-end:${match.id}`) }, [match.id])
  return <section className="panel round-intermission"><span className="eyebrow yellow">{match.outcome === 'timeout' ? 'TIME’S UP! · ' : ''}ROUND {match.round_number} COMPLETE</span><h2 className={draw ? 'blue' : won ? 'yellow' : 'red'}>{draw ? 'ROUND DRAWN' : won ? 'ROUND WON!' : 'RIVAL TAKES THE ROUND'}</h2><p>{draw ? 'Equal confirmed progress. Replay this round with a fresh puzzle; neither player gains a point.' : match.outcome === 'timeout' ? 'The server awarded the round to the player with more correct entries.' : 'The first complete solution was verified by the server.'}</p>
    <div className="intermission-score">{s.battle!.score.map((p) => <div key={p.user_id}><span>{s.players.find((player) => player.user_id === p.user_id)?.username}</span><strong>{p.rounds_won}</strong><small>ROUND WINS</small></div>)}</div><p>First to two wins. The next round starts with zero energy and a fresh grid.</p>
    {both ? <button className="button button-gold" disabled={busy} onClick={() => void start()}>START {draw ? 'ROUND REPLAY' : 'NEXT ROUND'}</button> : ready ? <p role="status" className="yellow">READY · WAITING FOR YOUR RIVAL</p> : <button className="button" disabled={busy} onClick={() => void command('next_ready', { match_id: match.id })}>READY FOR {draw ? 'REPLAY' : 'NEXT ROUND'}</button>}
  </section>
}
