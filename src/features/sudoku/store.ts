import { create } from 'zustand'
import { type Difficulty, type Puzzle } from './engine'
import { createGame, elapsedMs, enterValue, undo, type Game } from './game'
import { readRecords, saveRecords, type PracticeRecord } from './statistics'

interface PracticeStore {
  game: Game | null; selected: number; pencil: boolean; loading: boolean; error: string | null
  accumulated: number; startedAt: number | null; records: PracticeRecord[]; storageWarning: boolean; active: boolean
  setActive: (active: boolean) => void
  newPuzzle: (difficulty: Difficulty) => void
  select: (index: number) => void; toggleNotes: () => void; place: (digit: number) => void
  undo: () => void; hint: () => void; pause: () => void; resume: () => void; restart: () => void
}

let generation = 0
export const usePractice = create<PracticeStore>((set, get) => {
  function apply(game: Game) {
    const previous = get()
    if (game === previous.game) return
    if (game.completed) {
      const elapsed = elapsedMs(previous.accumulated, previous.startedAt, Date.now())
      const record: PracticeRecord = { id: crypto.randomUUID(), difficulty: game.puzzle.difficulty, elapsed, mistakes: game.mistakes, hints: game.hints, date: new Date().toISOString() }
      const records = [record, ...previous.records].slice(0, 100)
      set({ game, records, accumulated: elapsed, startedAt: null, storageWarning: !saveRecords(records) })
    } else set({ game })
  }
  return {
    game: null, selected: 0, pencil: false, loading: false, error: null,
    accumulated: 0, startedAt: null, records: readRecords(), storageWarning: false, active: false,
    setActive(active) { if (!active) get().pause(); set({ active }) },
    newPuzzle(difficulty) {
      const request = ++generation
      get().pause()
      set({ loading: true, error: null })
      let worker: Worker
      try { worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' }) }
      catch { set({ loading: false, error: 'Puzzle generation is unavailable in this browser. Please retry in a current browser.' }); return }
      const timeout = window.setTimeout(() => finish({ error: 'Puzzle generation timed out. Please try again.' }), 15000)
      function finish(result: { puzzle?: Puzzle; error?: string }) {
        window.clearTimeout(timeout)
        worker.terminate()
        if (request !== generation) return
        if (!result.puzzle) { set({ loading: false, error: result.error ?? 'Unable to generate a puzzle. Please retry.' }); return }
        set({ game: createGame(result.puzzle), selected: result.puzzle.clues.indexOf(0), pencil: false, loading: false, accumulated: 0, startedAt: get().active && !document.hidden ? Date.now() : null, error: null })
      }
      worker.onmessage = (event: MessageEvent<{ puzzle?: Puzzle; error?: string }>) => finish(event.data)
      worker.onerror = () => finish({ error: 'Puzzle generation failed. Please try again.' })
      worker.postMessage(difficulty)
    },
    select: (selected) => set({ selected }),
    toggleNotes: () => set((s) => ({ pencil: !s.pencil })),
    place(digit) {
      const s = get()
      if (s.game && s.startedAt !== null && !s.loading) apply(enterValue(s.game, s.selected, digit, s.pencil && digit !== 0))
    },
    undo() { const s = get(); if (s.game && s.startedAt !== null && !s.loading) apply(undo(s.game)) },
    hint() {
      const s = get()
      if (!s.game || s.startedAt === null || s.loading) return
      const index = !s.game.puzzle.clues[s.selected] && s.game.values[s.selected] !== s.game.puzzle.solution[s.selected] ? s.selected : s.game.values.findIndex((n, i) => n !== s.game!.puzzle.solution[i])
      if (index >= 0) { set({ selected: index }); apply(enterValue(s.game, index, s.game.puzzle.solution[index], false, true)) }
    },
    pause() { const s = get(); if (s.startedAt !== null) set({ accumulated: elapsedMs(s.accumulated, s.startedAt, Date.now()), startedAt: null }) },
    resume() { const s = get(); if (s.game && !s.game.completed && !s.loading && s.startedAt === null) set({ startedAt: Date.now() }) },
    restart() { const s = get(); if (s.game) set({ game: createGame(s.game.puzzle), accumulated: 0, startedAt: Date.now(), pencil: false }) },
  }
})
