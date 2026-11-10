import type { RoomSnapshot } from '../multiplayer/types'
import { DEFAULT_PRESSURE_RULES } from './rules'
import type { GameEvent } from './events'

function battleEventText(event: GameEvent, s: RoomSnapshot): string | null {
  const p = event.payload, actor = s.players.find((player) => player.user_id === p.actor_id)?.username ?? 'Player', target = s.players.find((player) => player.user_id === p.target_id)?.username ?? 'Rival'
  if (event.kind === 'energy') return `${actor} completed ${(p.units as {kind: string}[]).map((u) => u.kind).join(' + ')} · +${p.stored} energy${Number(p.stored)<Number(p.generated) ? ' (cap)' : ''}`
  if (event.kind === 'cast') return p.skill === 'shield' ? `${actor} activated Shield` : `${actor} sent ${p.skill} to ${target}`
  if (event.kind === 'shield_block') return `${target} blocked ${actor}’s ${p.skill}`
  if (event.kind === 'mistake_pressure') return p.break ? `${actor}: MISTAKE ×${s.battle?.series.rules.mistakePressure?.threshold ?? DEFAULT_PRESSURE_RULES.threshold} · ${Number(p.stored)>0 ? `${target} +${p.stored} ENERGY` : Number(p.generated)>0 ? 'energy cap reached' : 'bonus limit reached'}` : `${actor}: mistake pressure ${p.pressure}/${s.battle?.series.rules.mistakePressure?.threshold ?? DEFAULT_PRESSURE_RULES.threshold}`
  if (event.kind === 'round_finished') return `Round ended · ${p.outcome}`
  return null
}
export function BattleFeed({ snapshot: s, userId }: { snapshot: RoomSnapshot; userId: string }) {
  const events = (s.events ?? []).filter((e) => e.match_id === s.match!.id).flatMap((e) => { const text = battleEventText(e,s); return text ? [{event:e,text}] : [] }).slice(-12).reverse()
  return <section className="battle-feed" aria-label="Live battle feed"><span className="eyebrow">LIVE FEED</span><ol>{events.map(({event,text}) => <li key={event.sequence} className={event.payload.actor_id === userId ? 'feed-own' : 'feed-rival'}><span className="feed-dot" /><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleTimeString([], {minute:'2-digit',second:'2-digit'})}</time><span>{text}</span></li>)}</ol>{!events.length && <p>Complete units to charge your skills. Mistake pressure can charge your rival’s energy.</p>}</section>
}
