import type { CSSProperties } from 'react'
import { Modal } from '../../components/Modal'
import type { RoomSnapshot } from '../multiplayer/types'
import { SKILLS, SKILL_COLORS, DEFAULT_BATTLE_RULES, DEFAULT_PRESSURE_RULES, type Skill } from './rules'
import { useFeedback } from './feedback'

interface Props { snapshot: RoomSnapshot; userId: string; now: number; disabled: boolean; cast: (skill: Skill) => void }
export function BattleHud({ snapshot: s, userId, now, disabled, cast }: Props) {
  const state = s.battle!.players.find((p) => p.user_id === userId)!
  const opponent = s.battle!.players.find((p) => p.user_id !== userId)!
  const rules = s.battle!.series.rules ?? DEFAULT_BATTLE_RULES
  const pulses = useFeedback((store) => store.pulses)
  const localGains = pulses.filter((p) => p.matchId === s.match!.id && (p.kind === 'energy' && p.actorId === userId || p.kind === 'pressure' && p.targetId === userId && Number(p.stored)>0))
  return <section className="battle-toolbar panel" aria-label="Battle skills"><div className={`energy-meter${localGains.length ? ' energy-earned' : ''}`}><div><span className="eyebrow">ENERGY</span><strong aria-label="Your energy">{state.energy} / {rules.maxEnergy}</strong></div><div className="energy-chips" aria-hidden="true">{Array.from({ length: rules.maxEnergy }, (_, i) => <i className={i < state.energy ? 'charged' : ''} key={i} />)}</div>{localGains.map((pulse) => <span className="energy-transfer" key={pulse.id} aria-hidden="true">{[0,1,2].map((i) => <i key={i} style={{ '--particle': i } as CSSProperties} />)}</span>)}<p>Rows +{rules.rewards.row} · Columns +{rules.rewards.column} · Boxes +{rules.rewards.box}</p></div>
    {SKILLS.map((skill) => {
      const rule = rules.skills[skill]
      const target = skill === 'shield' ? userId : opponent.user_id
      const active = s.battle!.effects.some((e) => e.skill === skill && e.target_id === target && Date.parse(e.expires_at) > now)
      const cooldown = Math.max(0, Date.parse(state.cooldown_until ?? '') - now)
      const immunity = skill === 'freeze' && Date.parse(opponent.freeze_immunity_until ?? '') > now
      const reason = disabled ? 'ROUND NOT READY' : active ? 'ALREADY ACTIVE' : immunity ? 'RIVAL IMMUNE' : cooldown > 0 ? `${(cooldown / 1000).toFixed(1)}s COOLDOWN` : state.energy < rule.cost ? `NEED ${rule.cost} · HAVE ${state.energy}` : `${rule.durationMs / 1000}s · READY`
      return <button className={`skill-button skill-${skill}`} key={skill} disabled={disabled || active || immunity || cooldown > 0 || state.energy < rule.cost} onClick={() => cast(skill)} aria-label={`Cast ${skill}. ${rule.cost} energy. ${reason}`}><img src={`/figma/skill-${skill}.svg`} width="33" height="33" alt="" /><span className="skill-cost">{rule.cost}</span><strong>{skill.toUpperCase()}</strong><small>{reason}</small></button>
    })}
  </section>
}

export function SkillGuide({ snapshot, onClose }: { snapshot: RoomSnapshot; onClose: () => void }) {
  const rules = snapshot.battle?.series.rules ?? DEFAULT_BATTLE_RULES
  const pressure = rules.mistakePressure ?? DEFAULT_PRESSURE_RULES
  const text: Record<Skill, string> = { fog: 'Conceals one random 3×3 region.', freeze: `Locks number entry. Followed by ${rules.freezeImmunityMs / 1000}s of Freeze immunity.`, scramble: 'Reorders the visible keypad. Every button still enters its displayed digit. Keyboard digits keep their meaning.', shield: 'Blocks the next valid incoming attack, then is consumed. No stacking.' }
  return <Modal title="ATTACK ARSENAL" onClose={onClose} mobileSheet><p>Time your skills to protect your grid and disrupt your rival.</p><div className="skill-guide-list">{SKILLS.map((skill) => <article key={skill}><img src={`/figma/skill-${skill}.svg`} width="33" height="33" alt="" /><div><h3 className={SKILL_COLORS[skill]}>{skill.toUpperCase()} · {rules.skills[skill].cost} ENERGY</h3><p>{text[skill]} {rules.skills[skill].durationMs / 1000}s duration.</p></div></article>)}</div><p className="hint-note">Maximum {rules.maxEnergy} energy. Each row and column awards +1, each box +2, once per round. A single move can complete several units. No combo multiplier. {rules.cooldownMs / 1000}s shared cast cooldown. The match continues while menus are open.</p><p className="hint-note">Every {pressure.threshold} genuine mistakes grants your rival +{pressure.energyPerBreak} energy, up to {pressure.maxRewardsPerRound} bonuses per round. Energy at capacity is discarded. Wrong numbers leave your confirmed board unchanged and lock entry for {pressure.recoveryMs / 1000}s. Retrying an unchanged cell does not add pressure. Notes and erasing do not count.</p></Modal>
}
