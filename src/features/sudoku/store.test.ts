import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePuzzle, type Puzzle } from './engine'
import { createGame } from './game'
import { usePractice } from './store'

class TestWorker {
  static instances: TestWorker[] = []
  onmessage: ((event: MessageEvent<{ puzzle?: Puzzle; error?: string }>) => void) | null = null
  onerror: (() => void) | null = null
  terminated = false
  constructor() { TestWorker.instances.push(this) }
  postMessage() { /* Tests explicitly deliver asynchronous worker responses. */ }
  terminate() { this.terminated = true }
  deliver(puzzle: Puzzle) { this.onmessage?.({ data: { puzzle } } as MessageEvent<{ puzzle: Puzzle }>) }
}

const puzzle = generatePuzzle('easy')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10000)
  vi.stubGlobal('Worker', TestWorker)
  vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout })
  vi.stubGlobal('document', { hidden: false })
  vi.stubGlobal('localStorage', { setItem: vi.fn() })
  TestWorker.instances = []
  usePractice.setState({ game: null, selected: 0, pencil: false, loading: false, error: null, accumulated: 0, startedAt: null, records: [], storageWarning: false, active: true })
})

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Practice session lifecycle', () => {
  it('starts a worker-generated game and cleans up the worker', () => {
    usePractice.getState().newPuzzle('easy')
    expect(usePractice.getState().loading).toBe(true)
    const worker = TestWorker.instances[0]
    worker.deliver(puzzle)
    expect(worker.terminated).toBe(true)
    expect(usePractice.getState().game?.values).toEqual(puzzle.clues)
    expect(usePractice.getState().startedAt).toBe(10000)
    expect(usePractice.getState().loading).toBe(false)
  })
  it('ignores stale generation responses when a newer request wins', () => {
    const newer = generatePuzzle('medium')
    usePractice.getState().newPuzzle('easy')
    usePractice.getState().newPuzzle('medium')
    TestWorker.instances[1].deliver(newer)
    TestWorker.instances[0].deliver(puzzle)
    expect(usePractice.getState().game?.puzzle).toEqual(newer)
  })
  it('does not run the timer when generation finishes off the practice route', () => {
    usePractice.getState().newPuzzle('easy')
    usePractice.getState().setActive(false)
    TestWorker.instances[0].deliver(puzzle)
    expect(usePractice.getState().startedAt).toBeNull()
    usePractice.getState().setActive(true)
    expect(usePractice.getState().startedAt).toBeNull()
    usePractice.getState().resume()
    expect(usePractice.getState().startedAt).toBe(10000)
  })
  it('pauses without drift, rejects paused moves, and resumes explicitly', () => {
    const selected = puzzle.clues.indexOf(0)
    usePractice.setState({ game: createGame(puzzle), selected, startedAt: 10000 })
    vi.advanceTimersByTime(2300)
    usePractice.getState().pause()
    expect(usePractice.getState().accumulated).toBe(2300)
    usePractice.getState().place(puzzle.solution[selected])
    expect(usePractice.getState().game?.values[selected]).toBe(0)
    vi.advanceTimersByTime(5000)
    expect(usePractice.getState().accumulated).toBe(2300)
    usePractice.getState().resume()
    expect(usePractice.getState().startedAt).toBe(17300)
  })
  it('times out failed generation and exposes a recoverable error', () => {
    usePractice.getState().newPuzzle('easy')
    vi.advanceTimersByTime(15000)
    expect(usePractice.getState().loading).toBe(false)
    expect(usePractice.getState().error).toMatch(/timed out/)
    expect(TestWorker.instances[0].terminated).toBe(true)
    usePractice.getState().newPuzzle('easy')
    TestWorker.instances[1].deliver(puzzle)
    expect(usePractice.getState().error).toBeNull()
  })
  it('records completion once and stops the timer even on duplicate input', () => {
    const selected = 0
    const nearlySolved = { ...puzzle, clues: puzzle.solution.map((n, i) => i === selected ? 0 : n) }
    usePractice.setState({ game: createGame(nearlySolved), selected, startedAt: 9000 })
    usePractice.getState().place(puzzle.solution[selected])
    usePractice.getState().place(puzzle.solution[selected])
    expect(usePractice.getState().records).toHaveLength(1)
    expect(usePractice.getState().accumulated).toBe(1000)
    expect(usePractice.getState().startedAt).toBeNull()
    expect(localStorage.setItem).toHaveBeenCalledTimes(1)
  })
})
