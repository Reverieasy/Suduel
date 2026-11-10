import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useFeedback } from './feedback'
import { unitCells } from './rules'
import { useReducedMotion } from '../audio/useReducedMotion'
import { usePreferences } from '../audio/preferences'
import { audioManager } from '../audio/manager'
import type { RoomSnapshot } from '../multiplayer/types'

type Effect = NonNullable<RoomSnapshot['battle']>['effects'][number]
export function ScreenEffects({ effects, now, matchId, playerId, audible = true }: { effects: Effect[]; now: number; matchId: string; playerId?: string; audible?: boolean }) {
  const pulses = useFeedback((s) => s.pulses)
  const reduced = useReducedMotion()
  const shake = usePreferences((s) => s.screenShake)
  const previous = useRef<Effect[]>([])
  useEffect(() => {
    for (const effect of previous.current) {
      if (audible && !effects.some((current) => current.id === effect.id) && Date.parse(effect.expires_at) <= now) {
        if (effect.skill === 'freeze') audioManager.play('freeze_end', `expire:${effect.id}`)
        if (effect.skill === 'scramble') audioManager.play('scramble_end', `expire:${effect.id}`)
      }
    }
    previous.current = effects
  }, [effects, now, audible])
  return <div className="screen-effects" aria-hidden="true">
    {effects.map((effect) => {
      const remaining = Math.max(0, Date.parse(effect.expires_at) - now)
      if (effect.skill === 'fog') return <div key={effect.id} data-effect="fog" className={`fog-mask${remaining < 300 ? ' effect-ending' : ''}`} style={{ left: `${(effect.region! % 3) * 100 / 3}%`, top: `${Math.floor(effect.region! / 3) * 100 / 3}%` }}><span className="fog-cloud cloud-a" /><span className="fog-cloud cloud-b" /><span className="fog-cloud cloud-c" /><strong>FOG</strong><small>{(remaining / 1000).toFixed(1)}s</small></div>
      if (effect.skill === 'freeze') return <div key={effect.id} data-effect="freeze" className={`frost-overlay${remaining < 180 ? ' effect-ending' : ''}`}><div className="frost-crystals">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--particle': i } as CSSProperties}>✦</i>)}</div><span>FROZEN · {(remaining / 1000).toFixed(1)}s</span></div>
      if (effect.skill === 'shield') return <div key={effect.id} data-effect="shield" className="shield-aura"><span>SHIELD · {Math.ceil(remaining / 1000)}s</span></div>
      return <div key={effect.id} data-effect="scramble" className="scramble-accent"><span>DIGITS SHUFFLED · {(remaining / 1000).toFixed(1)}s</span></div>
    })}
    {pulses.filter((p) => p.matchId === matchId && p.kind !== 'pressure' && (!playerId || (p.kind === 'energy' || p.kind === 'wrong' ? p.actorId === playerId : p.kind === 'cast' ? p.skill === 'shield' ? p.actorId === playerId : p.targetId === playerId : p.targetId === playerId))).map((pulse) => <div key={pulse.id} className={`feedback-visual visual-${pulse.kind} skill-${pulse.blocked?'shield':pulse.skill ?? 'energy'}${pulse.kind === 'impact' && shake && !reduced ? ' light-shake' : ''}`}>
      {(pulse.kind === 'impact' || pulse.kind === 'block' || pulse.kind === 'cast' && pulse.skill !== 'shield') && <span className="impact-ring" />}
      {pulse.kind === 'cast' && pulse.skill === 'shield' && <span className="skill-projectile projectile-shield"><img src="/figma/projectile-shield.svg" width="59" height="59" alt="" /></span>}
      {pulse.kind === 'energy' && pulse.units?.map((unit) => <div className={`unit-sweep unit-${unit.kind}`} key={`${unit.kind}:${unit.index}`} style={unit.kind === 'row' ? { top: `${unit.index * 100 / 9}%`, height: `${100 / 9}%`, width: '100%' } : unit.kind === 'column' ? { left: `${unit.index * 100 / 9}%`, width: `${100 / 9}%`, height: '100%' } : { top: `${Math.floor(unit.index / 3) * 100 / 3}%`, left: `${unit.index % 3 * 100 / 3}%`, width: `${100 / 3}%`, height: `${100 / 3}%` }} data-cells={unitCells(unit.kind, unit.index).join(',')} />)}
      {!reduced && pulse.kind !== 'wrong' && <span className="impact-particles">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--particle': i } as CSSProperties} />)}</span>}
    </div>)}
  </div>
}

export function PressureTransfers({ matchId, userId }: { matchId: string; userId: string }) {
  const pulses = useFeedback((s) => s.pulses), reduced = useReducedMotion()
  if(reduced)return null
  return <div className="pressure-transfer-layer" aria-hidden="true">{pulses.filter((p) => p.matchId===matchId&&p.kind==='pressure'&&Number(p.stored)>0).map((p) => <span key={p.id} className={`pressure-transfer ${p.actorId===userId?'to-rival':'to-you'}`}><i/><i/><i/></span>)}</div>
}

export function AttackFlights({ matchId }: { matchId: string }) {
  const pulses = useFeedback((s) => s.pulses)
  const reduced = useReducedMotion()
  if (reduced) return null
  return <div className="attack-flight-layer" aria-hidden="true">{pulses.filter((p) => p.matchId === matchId && p.kind === 'cast' && p.skill !== 'shield').map((p) => <span className={`arena-flight skill-${p.skill}`} key={p.id}><span className={`skill-projectile projectile-${p.skill}`}><img src={`/figma/projectile-${p.skill}.svg`} width="59" height="59" alt="" /><i /><i /><i /></span></span>)}</div>
}

export function BattleAnnouncements({ matchId, battle = true }: { matchId: string; battle?: boolean }) {
  const pulses = useFeedback((s) => s.pulses)
  useEffect(() => { const timer = window.setInterval(() => useFeedback.getState().clearExpired(), 200); return () => window.clearInterval(timer) }, [])
  const latest = pulses.filter((p) => p.matchId === matchId).at(-1)
  return <div className={`battle-announcements skill-${latest?.skill ?? 'energy'}`} aria-live="polite" aria-atomic="true">{latest ? <><strong>{latest.text}</strong><span>{latest.detail}</span></> : <span>{battle ? 'Complete units to charge your next move.' : 'Your confirmed moves appear on the board.'}</span>}</div>
}
