import { describe, expect, it } from 'vitest'
import { conflicts, countSolutions, CLUE_TARGETS, type Difficulty } from './engine'
import { difficultyMatched, estimateDifficulty, generateBattlePair } from './battlePuzzles'

function rng(seed: number) { let state=seed;return () => {state=(1664525*state+1013904223)>>>0;return state/4294967296} }
describe('server Battle puzzle pairing', () => {
  it.each<Difficulty>(['easy','medium','hard'])('assigns distinct, unique, solver-matched %s puzzles', (difficulty) => {
    for(let seed=1;seed<=6;seed++) {
      const [a,b]=generateBattlePair(difficulty,rng(seed*1729))
      expect(a.clues).not.toEqual(b.clues);expect(a.solution).not.toEqual(b.solution)
      for(const puzzle of [a,b]) {
        expect(puzzle.clues).toHaveLength(81);expect(puzzle.solution).toHaveLength(81)
        expect(conflicts(puzzle.solution).size).toBe(0);expect(countSolutions(puzzle.clues)).toBe(1)
        expect(puzzle.clues.filter(Boolean).length).toBeGreaterThanOrEqual(CLUE_TARGETS[difficulty])
        expect(puzzle.clues.every((n,i) => !n||n===puzzle.solution[i])).toBe(true)
        expect(estimateDifficulty(puzzle.clues)).toEqual(puzzle.estimate)
      }
      expect(difficultyMatched(a.estimate,b.estimate)).toBe(true)
      expect(Math.abs(a.estimate.score-b.estimate.score)).toBeLessThanOrEqual(Math.max(6,Math.min(a.estimate.score,b.estimate.score)*.2))
      expect(JSON.stringify(a.estimate)).not.toContain('solution')
    }
  })
  it('rejects invalid clues and refuses to call a duplicate pool a fair pair', () => {
    expect(() => estimateDifficulty(Array(81).fill(1))).toThrow('Invalid')
    expect(() => generateBattlePair('easy',() => .5)).toThrow('fair puzzle pair')
  })
  it('does not match logical-only work with a guessing puzzle or a large score gap', () => {
    const base=generateBattlePair('easy',rng(123))[0].estimate
    expect(difficultyMatched(base,{...base,guesses:1})).toBe(false)
    expect(difficultyMatched(base,{...base,score:base.score*2})).toBe(false)
  })
})
