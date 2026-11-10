import { describe, expect, it } from 'vitest'
import { generatePuzzle, sameUnit } from './engine'
import { createGame, elapsedMs, enterValue, formatTime, undo } from './game'

const puzzle = generatePuzzle('easy')
const empty = puzzle.clues.indexOf(0)

describe('Practice rules', () => {
  it('preserves clues and ignores malformed moves', () => {
    const game = createGame(puzzle)
    for (const [index, digit] of [[puzzle.clues.findIndex(Boolean), 0], [-1, 1], [81, 1], [empty, 10], [empty, 1.2]]) expect(enterValue(game, index, digit)).toBe(game)
    expect(game.values).toEqual(puzzle.clues)
  })
  it('toggles notes without altering values or awarding mistakes', () => {
    const original = createGame(puzzle)
    const noted = enterValue(original, empty, 3, true)
    expect(noted.notes[empty]).toEqual([3])
    expect(noted.values).toEqual(original.values)
    expect(noted.mistakes).toBe(0)
    expect(enterValue(noted, empty, 3, true).notes[empty]).toEqual([])
    expect(undo(noted)).toMatchObject({ values: original.values, notes: original.notes })
  })
  it('counts incorrect entries once per changed move and keeps mistakes after undo', () => {
    const game = createGame(puzzle)
    const digit = puzzle.solution[empty] % 9 + 1
    const wrong = enterValue(game, empty, digit)
    expect(wrong.mistakes).toBe(1)
    expect(enterValue(wrong, empty, digit)).toBe(wrong)
    expect(undo(wrong).mistakes).toBe(1)
    expect(undo(wrong).values).toEqual(game.values)
    expect(enterValue(wrong, empty, 0).values[empty]).toBe(0)
  })
  it('cleans matching peer notes on a correct move and undo restores them', () => {
    let game = createGame(puzzle)
    const peer = game.values.findIndex((n, i) => !n && i !== empty && sameUnit(i, empty))
    expect(peer).toBeGreaterThanOrEqual(0)
    const digit = puzzle.solution[empty]
    game = enterValue(game, peer, digit, true)
    const next = enterValue(game, empty, digit)
    expect(next.notes[peer]).toEqual([])
    expect(undo(next).notes[peer]).toEqual([digit])
  })
  it('tracks assistance, completes a real puzzle and locks finished games', () => {
    let game = createGame(puzzle)
    game = enterValue(game, empty, puzzle.solution[empty], false, true)
    expect(game.hints).toBe(1)
    for (let i = 0; i < 81; i++) if (!puzzle.clues[i]) game = enterValue(game, i, puzzle.solution[i])
    expect(game.completed).toBe(true)
    expect(enterValue(game, empty, 0)).toBe(game)
    expect(undo(game)).toBe(game)
  })
  it('does not accumulate interval drift or count paused time', () => {
    expect(elapsedMs(3000, 1000, 6150)).toBe(8150)
    expect(elapsedMs(8150, null, 20000)).toBe(8150)
    expect(elapsedMs(8150, 20000, 21000)).toBe(9150)
    expect(elapsedMs(0, 20000, 19000)).toBe(0)
    expect(formatTime(125999)).toBe('02:05')
    expect(formatTime(3600000)).toBe('60:00')
  })
})
