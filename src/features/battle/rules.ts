export type Skill = 'fog' | 'freeze' | 'scramble' | 'shield'
export type UnitKind = 'row' | 'column' | 'box'
export interface CompletedUnit { kind: UnitKind; index: number; reward: number }
export type BattleRules = {
  version: number; maxEnergy: number; cooldownMs: number; freezeImmunityMs: number
  rewards: Record<UnitKind, number>; skills: Record<Skill, { cost: number; durationMs: number }>
}
export const BATTLE_SKILLS = {
  fog: { cost: 1, durationMs: 3000 }, freeze: { cost: 2, durationMs: 1500 },
  scramble: { cost: 2, durationMs: 5000 }, shield: { cost: 2, durationMs: 15000 },
} as const
export const DEFAULT_BATTLE_RULES: BattleRules = {
  version: 1, maxEnergy: 5, cooldownMs: 1000, freezeImmunityMs: 3000,
  rewards: { row: 1, column: 1, box: 2 }, skills: BATTLE_SKILLS,
}
export const SKILLS: Skill[] = ['fog', 'freeze', 'scramble', 'shield']
export const SKILL_COLORS: Record<Skill, string> = { fog: 'blue', freeze: 'purple', scramble: 'orange', shield: 'green' }
export const NORMAL_KEYPAD = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function unitCells(kind: UnitKind, index: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index > 8) return []
  return Array.from({ length: 9 }, (_, i) => kind === 'row' ? index * 9 + i : kind === 'column' ? i * 9 + index : Math.floor(index / 3) * 27 + index % 3 * 3 + Math.floor(i / 3) * 9 + i % 3)
}
export function validKeypad(value: number[] | null | undefined): number[] {
  return value?.length === 9 && new Set(value).size === 9 && value.every((n) => NORMAL_KEYPAD.includes(n)) ? value : NORMAL_KEYPAD
}
export function timerPhase(remainingMs: number): 'normal' | 'warning' | 'danger' | 'critical' | 'expired' {
  if (remainingMs <= 0) return 'expired'
  if (remainingMs <= 5000) return 'critical'
  if (remainingMs <= 10000) return 'danger'
  return remainingMs <= 30000 ? 'warning' : 'normal'
}
