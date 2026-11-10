import { useSyncExternalStore } from 'react'
import { usePreferences } from './preferences'

const media = () => typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const subscribeMotion = (notify: () => void) => { const query = media(); query?.addEventListener('change', notify); return () => query?.removeEventListener('change', notify) }
export function useReducedMotion() {
  const forced = usePreferences((s) => s.reducedMotion)
  const system = useSyncExternalStore(subscribeMotion, () => media()?.matches ?? false, () => false)
  return forced || system
}
