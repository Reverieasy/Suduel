import { useFeedback } from './feedback'
import { rowCelebration } from './rules'

export function RowCelebration({ matchId, playerId, rival = false }: { matchId: string; playerId: string; rival?: boolean }) {
  const pulse=useFeedback((s) => s.pulses.filter((p) => p.matchId===matchId && p.actorId===playerId && p.kind==='energy' && p.units?.some((unit) => unit.kind==='row')).at(-1))
  if(!pulse)return null
  return <div key={pulse.id} className={`row-celebration${rival?' is-rival':''}`} role="status" aria-label={`${rival?'Rival':'Your'} row celebration`} aria-live="polite" aria-atomic="true"><div className="row-praise-card"><span className="row-praise-label">{rival?'RIVAL · ':''}{pulse.units!.length>1?`${pulse.units!.length} UNITS COMPLETE`:'ROW COMPLETE'}</span><strong>{rowCelebration(pulse.units!)}</strong><span className="row-praise-energy">{pulse.detail}</span><i aria-hidden="true"/><i aria-hidden="true"/><i aria-hidden="true"/><i aria-hidden="true"/></div></div>
}
