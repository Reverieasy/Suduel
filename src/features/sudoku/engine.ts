export type Difficulty = 'easy' | 'medium' | 'hard'
export type Board = number[]
export interface Puzzle { clues: Board; solution: Board; difficulty: Difficulty }
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export const CLUE_TARGETS: Record<Difficulty, number> = { easy: 42, medium: 34, hard: 28 }

export function sameUnit(a: number, b: number): boolean {
  return Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 ||
    (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor(a % 9 / 3) === Math.floor(b % 9 / 3))
}

export function validBoard(board: readonly number[]): boolean {
  return board.length === 81 && board.every((n) => Number.isInteger(n) && n >= 0 && n <= 9)
}

export function conflicts(board: readonly number[]): Set<number> {
  const result = new Set<number>()
  for (let a = 0; a < 81; a++) {
    if (!board[a]) continue
    for (let b = a + 1; b < 81; b++) {
      if (board[a] === board[b] && sameUnit(a, b)) { result.add(a); result.add(b) }
    }
  }
  return result
}

export function isComplete(board: readonly number[]): boolean {
  return validBoard(board) && board.every((n) => n > 0) && conflicts(board).size === 0
}

/** MRV backtracking. Stops at the limit; never mutates its input. */
export function countSolutions(input: readonly number[], limit = 2): number {
  if (!validBoard(input) || conflicts(input).size > 0 || limit < 1) return 0
  const board = [...input]
  let count = 0
  function visit() {
    if (count >= limit) return
    let selected = -1
    let choices: number[] = []
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue
      const available = DIGITS.filter((digit) => !board.some((n, j) => n === digit && sameUnit(i, j)))
      if (!available.length) return
      if (selected === -1 || available.length < choices.length) { selected = i; choices = available }
      if (choices.length === 1) break
    }
    if (selected === -1) { count++; return }
    for (const digit of choices) {
      board[selected] = digit
      visit()
      if (count >= limit) break
    }
    board[selected] = 0
  }
  visit()
  return count
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Permutes a valid full grid, then removes only clues that preserve uniqueness. */
export function generatePuzzle(difficulty: Difficulty, random = Math.random): Puzzle {
  const groups = [0, 1, 2]
  const rows = shuffled(groups, random).flatMap((g) => shuffled(groups, random).map((n) => g * 3 + n))
  const cols = shuffled(groups, random).flatMap((g) => shuffled(groups, random).map((n) => g * 3 + n))
  const digits = shuffled(DIGITS, random)
  const solution = rows.flatMap((r) => cols.map((c) => digits[(r * 3 + Math.floor(r / 3) + c) % 9]))
  const clues: Board = [...solution]
  let remaining = 81
  for (const index of shuffled(Array.from({ length: 81 }, (_, i) => i), random)) {
    if (remaining <= CLUE_TARGETS[difficulty]) break
    const previous = clues[index]
    clues[index] = 0
    if (countSolutions(clues) === 1) remaining--
    else clues[index] = previous
  }
  return { clues, solution, difficulty }
}
