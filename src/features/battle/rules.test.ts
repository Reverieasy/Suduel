import { describe, expect, it } from 'vitest'
import { unitCells, validKeypad, NORMAL_KEYPAD, timerPhase } from './rules'
import { CueGate, EventCursor, type GameEvent } from './events'
import { parsePreferences, DEFAULT_PREFERENCES } from '../audio/preferences'

describe('battle presentation boundaries', () => {
  it('maps every Sudoku unit to nine distinct in-range cells', () => {
    for (const kind of ['row', 'column', 'box'] as const) {
      const all = Array.from({ length: 9 }, (_, index) => unitCells(kind, index)).flat()
      expect(all).toHaveLength(81); expect(new Set(all).size).toBe(81)
      expect(Math.min(...all)).toBe(0); expect(Math.max(...all)).toBe(80)
    }
    expect(unitCells('box', 4)).toEqual([30,31,32,39,40,41,48,49,50])
    expect(unitCells('row', 9)).toEqual([])
  })
  it('preserves valid keypad permutations and rejects lost, duplicated or foreign digits', () => {
    const shuffled = [9,4,6,3,1,5,8,2,7]
    expect(validKeypad(shuffled)).toBe(shuffled)
    for (const value of [null, undefined, [1,2], [1,1,3,4,5,6,7,8,9], [0,2,3,4,5,6,7,8,9]]) expect(validKeypad(value)).toEqual(NORMAL_KEYPAD)
  })
  it.each([[30001,'normal'],[30000,'warning'],[10001,'warning'],[10000,'danger'],[5001,'danger'],[5000,'critical'],[1,'critical'],[0,'expired'],[-1,'expired']])('uses the server-derived urgency boundary at %sms', (ms, phase) => {
    expect(timerPhase(Number(ms))).toBe(phase)
  })
  it('starts without replay, orders new cues, ignores duplicates and suppresses old recovery impacts', () => {
    const cursor = new EventCursor()
    const event = (sequence: number, age = 0): GameEvent => ({ sequence, match_id: 'match', kind: 'cast', created_at: new Date(10000-age).toISOString(), payload: {} })
    expect(cursor.accept([event(1)],1,10000)).toEqual([])
    expect(cursor.accept([event(3),event(1),event(2)],3,10000).map((e) => e.sequence)).toEqual([2,3])
    expect(cursor.accept([event(3)],3,10000)).toEqual([])
    expect(cursor.accept([event(4,2500),event(5)],5,10000).map((e) => e.sequence)).toEqual([5])
    expect(cursor.accept([event(4)],4,10000)).toEqual([])
    expect(cursor.accept([event(5)],5,10000)).toEqual([])
  })
  it('deduplicates stable IDs and rate-limits rapid cues without delayed replay', () => {
    const gate = new CueGate()
    expect(gate.allow('wrong','a',0,220)).toBe(true)
    expect(gate.allow('wrong','a',1000,220)).toBe(false)
    expect(gate.allow('wrong','b',100,220)).toBe(false)
    expect(gate.allow('wrong','b',1000,220)).toBe(false)
    expect(gate.allow('wrong','c',221,220)).toBe(true)
    expect(gate.allow('impact','d',221,220)).toBe(true)
  })
  it('validates persisted sound preferences without accepting corrupt volume values', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences({ masterVolume: 3, effectsVolume: -2, sound: false, countdownSound: false, reducedMotion: true })).toMatchObject({ masterVolume: 1, effectsVolume: 0, sound: false, countdownSound: false, reducedMotion: true })
    expect(parsePreferences({ masterVolume: NaN, effectsVolume: 'loud', sound: 'false' })).toEqual(DEFAULT_PREFERENCES)
  })
})
