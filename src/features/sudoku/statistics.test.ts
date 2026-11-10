import { afterEach, describe, expect, it, vi } from 'vitest'
import { readRecords, saveRecords, type PracticeRecord } from './statistics'

afterEach(() => vi.unstubAllGlobals())

describe('Local practice records', () => {
  it('recovers from corrupt or inaccessible browser storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad json' })
    expect(readRecords()).toEqual([])
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(readRecords()).toEqual([])
    expect(saveRecords([])).toBe(false)
  })
  it('rejects malformed records and caps retained history', () => {
    const record: PracticeRecord = { id: 'test', difficulty: 'easy', elapsed: 1000, mistakes: 0, hints: 0, date: '2026-11-10T00:00:00Z' }
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify([null, {}, { ...record, elapsed: -1 }, ...Array.from({ length: 120 }, (_, i) => ({ ...record, id: String(i) }))]) })
    expect(readRecords()).toHaveLength(100)
    expect(readRecords()[0].id).toBe('0')
  })
})
