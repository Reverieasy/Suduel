import { useEffect, useRef } from 'react'
import { formatTime } from '../sudoku/game'
import { audioManager } from '../audio/manager'
import { timerPhase } from './rules'
import type { RoomSnapshot } from '../multiplayer/types'

export function MatchTimer({ snapshot: s, now, userId }: { snapshot: RoomSnapshot; now: number; userId: string }) {
  const match = s.match!
  const countdown = Math.max(0, Math.ceil((Date.parse(match.started_at) - now) / 1000))
  const remaining = Math.max(0, Date.parse(match.ends_at) - now)
  const second = Math.ceil(remaining / 1000)
  const previous = useRef<number | null>(null)
  const phase = timerPhase(remaining)
  useEffect(() => {
    if (countdown > 0) { audioManager.play('countdown', `start:${match.id}:${countdown}`); return }
    if (previous.current === second) return
    const old = previous.current; previous.current = second
    if (old === null) return
    if (old > 30 && second <= 30 && second > 10) audioManager.play('warning', `warning:${match.id}`)
    if (second > 0 && second <= 10) audioManager.play(second === 1 ? 'tick_final' : second <= 3 ? 'tick_high' : 'tick', `tick:${match.id}:${second}`)
  }, [countdown, second, match.id])
  const battle = s.battle
  return <div className={`race-clock timer-${phase}`}><span className="eyebrow">{battle ? `BATTLE · ROUND ${match.round_number} · BEST OF THREE` : `CLASSIC RACE · ${match.difficulty.toUpperCase()}`}</span><strong role="timer" aria-label="Match time remaining" key={second}>{countdown ? `STARTS IN ${countdown}` : formatTime(second * 1000)}</strong><span className="eyebrow" role="status">{remaining <= 0 ? 'SERVER IS CONFIRMING THE RESULT…' : second <= 10 ? '10 SECONDS LEFT · MAKE YOUR MOVE' : second <= 30 ? 'FINAL 30 SECONDS' : battle ? 'TWO GRIDS. ONE WINNER.' : 'ONE GRID. ONE WINNER.'}</span>{battle && <div className="round-score" aria-label="Round score">{[...battle.score].sort((a) => a.user_id === userId ? -1 : 1).map((p) => <span key={p.user_id} className={p.user_id === userId ? 'blue' : 'red'}><span className="score-name">{s.players.find((player) => player.user_id === p.user_id)?.username}</span><b>{p.rounds_won}</b></span>)}</div>}</div>
}
