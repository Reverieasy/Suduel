import { create } from 'zustand'

export interface Preferences { sound: boolean; homeMusic: boolean; masterVolume: number; effectsVolume: number; countdownSound: boolean; reducedMotion: boolean; screenShake: boolean }
export const DEFAULT_PREFERENCES: Preferences = { sound: true, homeMusic: true, masterVolume: 0.65, effectsVolume: 0.7, countdownSound: true, reducedMotion: false, screenShake: true }
export function parsePreferences(value: unknown): Preferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const volume = (key: string, fallback: number) => typeof input[key] === 'number' && Number.isFinite(input[key]) ? Math.min(1, Math.max(0, input[key])) : fallback
  return { sound: typeof input.sound === 'boolean' ? input.sound : true, homeMusic: input.homeMusic !== false, masterVolume: volume('masterVolume', .65), effectsVolume: volume('effectsVolume', .7), countdownSound: typeof input.countdownSound === 'boolean' ? input.countdownSound : true, reducedMotion: input.reducedMotion === true, screenShake: input.screenShake !== false }
}
const KEY = 'suduel.preferences.v1'
function read(): Preferences { try { return parsePreferences(JSON.parse(localStorage.getItem(KEY) ?? '{}')) } catch { return DEFAULT_PREFERENCES } }
export const usePreferences = create<Preferences & { update: (patch: Partial<Preferences>) => void; storageWarning: boolean; musicPlaying: boolean }>((set, get) => ({
  ...read(), storageWarning: false, musicPlaying: false,
  update(patch) {
    const settings = parsePreferences({ ...get(), ...patch })
    let storageWarning = false
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { storageWarning = true }
    set({ ...settings, storageWarning })
  },
}))
