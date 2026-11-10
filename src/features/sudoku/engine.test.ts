import { describe, expect, it } from 'vitest'
import { CLUE_TARGETS, conflicts, countSolutions, generatePuzzle, isComplete, sameUnit, validBoard, type Difficulty } from './engine'

function seeded(seed: number) {
  let value = seed
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 }
}

describe('Sudoku engine', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
    it(`generates distinct, uniquely solvable ${difficulty} puzzles`, () => {
      const signatures = new Set<string>()
      for (let seed = 1; seed <= 5; seed++) {
        const puzzle = generatePuzzle(difficulty, seeded(seed))
        expect(isComplete(puzzle.solution)).toBe(true)
        expect(countSolutions(puzzle.clues)).toBe(1)
        expect(conflicts(puzzle.clues).size).toBe(0)
        expect(puzzle.clues.filter(Boolean).length).toBeGreaterThanOrEqual(CLUE_TARGETS[difficulty])
        expect(puzzle.clues.filter(Boolean).length).toBeLessThan(50)
        expect(puzzle.clues.every((n, i) => n === 0 || n === puzzle.solution[i])).toBe(true)
        signatures.add(puzzle.clues.join(''))
      }
      expect(signatures.size).toBe(5)
    })
  }
  it('validates board shape and values, including malformed input', () => {
    expect(validBoard(Array(81).fill(0))).toBe(true)
    for (const invalid of [[], Array(80).fill(1), Array(81).fill(10), Array(81).fill(-1), Array(81).fill(1.5), Array(81).fill(NaN)]) {
      expect(validBoard(invalid)).toBe(false)
      expect(isComplete(invalid)).toBe(false)
      expect(countSolutions(invalid)).toBe(0)
    }
  })
  it('finds row, column and box conflicts without marking unrelated values', () => {
    const board = Array<number>(81).fill(0)
    board[0] = board[8] = board[72] = board[10] = 5
    board[40] = 5
    expect(conflicts(board)).toEqual(new Set([0, 8, 10, 72]))
    expect(sameUnit(0, 10)).toBe(true)
    expect(sameUnit(0, 40)).toBe(false)
  })
  it('rejects impossible puzzles and stops counting ambiguous puzzles at two', () => {
    const invalid = Array<number>(81).fill(0); invalid[0] = invalid[1] = 1
    expect(countSolutions(invalid)).toBe(0)
    const blank = Array<number>(81).fill(0)
    expect(countSolutions(blank)).toBe(2)
    expect(blank.every((n) => n === 0)).toBe(true)
  })
  it('only declares a full legal board complete', () => {
    const puzzle = generatePuzzle('easy', seeded(9))
    expect(isComplete(puzzle.solution)).toBe(true)
    expect(isComplete(puzzle.clues)).toBe(false)
    expect(isComplete(Array(81).fill(1))).toBe(false)
    expect(countSolutions(puzzle.solution)).toBe(1)
  })
})
