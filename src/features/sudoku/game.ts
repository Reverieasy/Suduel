import { isComplete, sameUnit, type Puzzle } from './engine'

export interface Snapshot { values: number[]; notes: number[][] }
export interface Game extends Snapshot {
  puzzle: Puzzle
  mistakes: number
  hints: number
  history: Snapshot[]
  completed: boolean
}

export function createGame(puzzle: Puzzle): Game {
  return { puzzle, values: [...puzzle.clues], notes: Array.from({ length: 81 }, () => []), mistakes: 0, hints: 0, history: [], completed: false }
}

export function enterValue(game: Game, index: number, digit: number, pencil = false, hint = false): Game {
  if (!Number.isInteger(index) || index < 0 || index > 80 || !Number.isInteger(digit) || digit < 0 || digit > 9 || game.puzzle.clues[index] || game.completed) return game
  if (pencil && (digit === 0 || game.values[index])) return game
  if (!pencil && digit === game.values[index] && game.notes[index].length === 0) return game
  const values = [...game.values]
  const notes = game.notes.map((n) => [...n])
  if (pencil) {
    notes[index] = notes[index].includes(digit) ? notes[index].filter((n) => n !== digit) : [...notes[index], digit].sort()
  } else {
    values[index] = digit
    notes[index] = []
    if (digit === game.puzzle.solution[index]) {
      for (let j = 0; j < 81; j++) if (sameUnit(index, j)) notes[j] = notes[j].filter((n) => n !== digit)
    }
  }
  return {
    ...game, values, notes,
    mistakes: game.mistakes + (!pencil && digit > 0 && digit !== game.puzzle.solution[index] ? 1 : 0),
    hints: game.hints + (hint ? 1 : 0),
    history: [...game.history.slice(-199), { values: game.values, notes: game.notes }],
    completed: isComplete(values),
  }
}

export function undo(game: Game): Game {
  const snapshot = game.history.at(-1)
  if (!snapshot || game.completed) return game
  return { ...game, ...snapshot, history: game.history.slice(0, -1) }
}

export function elapsedMs(accumulated: number, startedAt: number | null, now: number): number {
  return accumulated + (startedAt === null ? 0 : Math.max(0, now - startedAt))
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
