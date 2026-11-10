import { useEffect } from 'react'
import { audioManager } from './manager'
import { usePreferences } from './preferences'
import { usePractice } from '../sudoku/store'
import { useReducedMotion } from './useReducedMotion'
import { unitCells } from '../battle/rules'

export function AudioSystem() {
  const reduced = useReducedMotion()
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(reduced) }, [reduced])
  useEffect(() => {
    const awarded = new Set<string>()
    const unlock = () => audioManager.unlock()
    document.addEventListener('pointerdown', unlock, { capture: true, passive: true })
    document.addEventListener('keydown', unlock, true)
    const visibility = () => { if (document.hidden) audioManager.silence() }
    document.addEventListener('visibilitychange', visibility)
    const unsubscribe = usePreferences.subscribe(() => audioManager.updateVolume())
    const practice = usePractice.subscribe((next, previous) => {
      if (next.game?.puzzle !== previous.game?.puzzle) awarded.clear()
      if (!next.game || !previous.game || next.game.puzzle !== previous.game.puzzle || next.startedAt === null && !next.game.completed) return
      if (next.selected !== previous.selected) audioManager.play('select')
      if (next.game === previous.game) return
      if (next.game.mistakes > previous.game.mistakes) audioManager.play('wrong_number')
      else if (next.game.values.some((n, i) => n > 0 && n !== previous.game!.values[i])) audioManager.play('valid_number')
      const completed: ('row' | 'column' | 'box')[] = []
      for (const kind of ['row', 'column', 'box'] as const) for (let index = 0; index < 9; index++) {
        const cells = unitCells(kind, index), key = `${kind}:${index}`
        if (awarded.has(key) || !cells.some((cell) => next.game!.puzzle.clues[cell] === 0)) continue
        if (cells.every((cell) => next.game!.values[cell] === next.game!.puzzle.solution[cell]) && !cells.every((cell) => previous.game!.values[cell] === next.game!.puzzle.solution[cell])) { awarded.add(key); completed.push(kind) }
      }
      if (completed.length) audioManager.play(completed.length >= 3 ? 'combo_3' : completed.length === 2 ? 'combo_2' : `${completed[0]}_complete`)
      if (next.game.completed && !previous.game.completed) audioManager.play('victory')
    })
    return () => { document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true); document.removeEventListener('visibilitychange', visibility); unsubscribe(); practice(); audioManager.dispose() }
  }, [])
  return null
}
