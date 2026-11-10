import { expect, it } from 'vitest'
import { progressPercent } from './types'

it('calculates progress against editable cells, excluding original clues', () => {
  const clues = Array<number>(81).fill(1).map((value, i) => i < 40 ? 0 : value)
  expect(progressPercent(0, clues)).toBe(0)
  expect(progressPercent(20, clues)).toBe(50)
  expect(progressPercent(40, clues)).toBe(100)
})
