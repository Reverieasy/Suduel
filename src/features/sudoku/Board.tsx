import { conflicts } from './engine'
import { SudokuGrid } from './SudokuGrid'
import { usePractice } from './store'

export function Board() {
  const game = usePractice((s) => s.game)!
  const selected = usePractice((s) => s.selected)
  const pencil = usePractice((s) => s.pencil)
  const invalid = conflicts(game.values)
  game.values.forEach((value, index) => {
    if (!game.puzzle.clues[index] && value > 0 && value !== game.puzzle.solution[index]) invalid.add(index)
  })
  const state = usePractice.getState()
  return <SudokuGrid clues={game.puzzle.clues} values={game.values} notes={game.notes} selected={selected} pencil={pencil} invalid={invalid} onSelect={state.select} onPlace={state.place} onToggleNotes={state.toggleNotes} onUndo={state.undo} />
}
