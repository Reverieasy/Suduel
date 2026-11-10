import type { Difficulty } from './engine'

export interface PracticeRecord { id: string; difficulty: Difficulty; elapsed: number; mistakes: number; hints: number; date: string }
const KEY = 'suduel.practice.v1'

export function readRecords(): PracticeRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((r): r is PracticeRecord => r && typeof r.id === 'string' && ['easy', 'medium', 'hard'].includes(r.difficulty) && Number.isFinite(r.elapsed) && r.elapsed >= 0 && Number.isInteger(r.mistakes) && r.mistakes >= 0 && Number.isInteger(r.hints) && r.hints >= 0 && typeof r.date === 'string').slice(0, 100)
  } catch { return [] }
}

export function saveRecords(records: PracticeRecord[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(records.slice(0, 100))); return true }
  catch { return false }
}
