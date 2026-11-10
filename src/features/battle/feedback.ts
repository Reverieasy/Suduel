import { create } from 'zustand'
import type { CompletedUnit, Skill } from './rules'

export interface FeedbackPulse {
  id: string; matchId: string; kind: 'energy' | 'cast' | 'impact' | 'block' | 'wrong' | 'pressure'
  actorId?: string; targetId?: string; mistakeTotal?: number; stored?: number
  blocked?: boolean
  skill?: Skill; cell?: number; units?: CompletedUnit[]; text: string; detail?: string
  expiresAt: number
}
export const useFeedback = create<{ pulses: FeedbackPulse[]; emit: (pulse: Omit<FeedbackPulse, 'expiresAt'>) => void; clearExpired: () => void }>((set) => ({
  pulses: [],
  emit(pulse) { set((state) => state.pulses.some((p) => p.id === pulse.id) ? state : { pulses: [...state.pulses.slice(-5), { ...pulse, expiresAt: Date.now() + (pulse.kind === 'wrong' ? 500 : 1300) }] }) },
  clearExpired() { set((state) => { const pulses = state.pulses.filter((p) => p.expiresAt > Date.now()); return pulses.length === state.pulses.length ? state : { pulses } }) },
}))
