import type { RoomSnapshot } from '../multiplayer/types'
import { DEFAULT_PRESSURE_RULES } from './rules'
import { useFeedback } from './feedback'

export function MistakePressure({ snapshot: s, playerId, label }: { snapshot: RoomSnapshot; playerId: string; label: string }) {
  const state = s.battle!.players.find((p) => p.user_id === playerId)!
  const rules = s.battle!.series.rules.mistakePressure ?? DEFAULT_PRESSURE_RULES
  const breaking = useFeedback((store) => store.pulses.some((p) => p.matchId === s.match!.id && p.kind === 'pressure' && p.actorId === playerId && p.mistakeTotal === state.genuine_mistakes))
  const pressure = breaking ? rules.threshold : state.mistake_pressure
  return <div className={`mistake-pressure${pressure === rules.threshold-1 ? ' pressure-near' : ''}${breaking ? ' pressure-broken' : ''}`} aria-label={`${label} mistake pressure`} role="meter" aria-valuemin={0} aria-valuemax={rules.threshold} aria-valuenow={pressure} aria-valuetext={`${pressure} of ${rules.threshold}; ${state.pressure_rewards} of ${rules.maxRewardsPerRound} bonuses triggered`}>
    <span>MISTAKE PRESSURE <b>{pressure}/{rules.threshold}</b></span><div className="pressure-segments" aria-hidden="true">{Array.from({ length: rules.threshold },(_,i) => <i key={i} className={i<pressure ? 'filled' : ''} />)}</div>
    <small>{state.genuine_mistakes} mistakes · {state.pressure_rewards}/{rules.maxRewardsPerRound} rival bonuses</small>
  </div>
}
