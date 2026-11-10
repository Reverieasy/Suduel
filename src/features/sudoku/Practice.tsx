import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Check, Clock3, Eraser, Keyboard, Lightbulb, Pause, Pencil, Play, RotateCcw, Sparkles, Trophy, Undo2 } from 'lucide-react'
import { Modal } from '../../components/Modal'
import { Board } from './Board'
import { DIGITS, type Difficulty } from './engine'
import { elapsedMs, formatTime } from './game'
import { usePractice } from './store'

function Timer() {
  const accumulated = usePractice((s) => s.accumulated)
  const startedAt = usePractice((s) => s.startedAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [startedAt])
  return <span className="practice-time" role="timer" aria-label="Elapsed time">{formatTime(elapsedMs(accumulated, startedAt, Math.max(now, startedAt ?? 0)))}</span>
}

function Keypad() {
  const game = usePractice((s) => s.game)!
  const paused = usePractice((s) => s.startedAt === null)
  const pencil = usePractice((s) => s.pencil)
  return <><div className="number-pad" aria-label="Number controls">{DIGITS.map((digit) => {
    const remaining = Math.max(0, 9 - game.values.filter((n) => n === digit).length)
    return <button key={digit} onClick={() => usePractice.getState().place(digit)} disabled={paused} aria-label={`Enter ${digit}`}><span>{digit}</span><small>{remaining}</small></button>
  })}</div><div className="board-tools">
    <button aria-pressed={pencil} onClick={() => usePractice.getState().toggleNotes()} disabled={paused}><Pencil size={18} /><span>Notes</span><small>{pencil ? 'ON' : 'N'}</small></button>
    <button onClick={() => usePractice.getState().place(0)} disabled={paused}><Eraser size={18} /><span>Erase</span><small>DEL</small></button>
    <button onClick={() => usePractice.getState().undo()} disabled={paused || game.history.length === 0}><Undo2 size={18} /><span>Undo</span><small>⌘ / CTRL Z</small></button>
  </div></>
}

export default function Practice() {
  const s = usePractice()
  const [difficulty, setDifficulty] = useState<Difficulty>(s.game?.puzzle.difficulty ?? 'easy')
  const [confirm, setConfirm] = useState<'new' | 'restart' | null>(null)
  const [dismissedResult, setDismissedResult] = useState(false)
  useEffect(() => {
    const state = usePractice.getState()
    state.setActive(true)
    if (!state.game && !state.loading) state.newPuzzle('easy')
    const onVisibility = () => { if (document.hidden) usePractice.getState().pause() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility); usePractice.getState().setActive(false) }
  }, [])
  function newGame() { setDismissedResult(false); s.newPuzzle(difficulty); setConfirm(null) }
  const game = s.game
  const total = game?.puzzle.clues.filter((n) => n === 0).length ?? 0
  const solved = game?.values.filter((n, i) => !game.puzzle.clues[i] && n === game.puzzle.solution[i]).length ?? 0
  const best = s.records.filter((r) => r.difficulty === (game?.puzzle.difficulty ?? difficulty) && r.hints === 0).reduce<number | null>((min, r) => min === null || r.elapsed < min ? r.elapsed : min, null)
  const paused = !!game && !game.completed && s.startedAt === null
  return <div className="container page-content practice-page">
    <header className="page-heading practice-heading"><div><Link to="/play" className="back-link"><ArrowLeft size={14} /> ALL MODES</Link><h1>PRACTICE MODE</h1><p>Improve your speed and accuracy. No pressure, no ranks.</p></div><span className="badge yellow"><i className="status-dot" /> SOLO TRAINING</span></header>
    {s.error && <div role="alert" className="error-banner"><span>{s.error}</span><button className="button button-small" onClick={newGame}>RETRY</button></div>}
    <div className="practice-layout"><section className="panel practice-game" aria-label="Practice game" aria-busy={s.loading}>
      <div className="practice-topline"><span className="eyebrow blue">{game?.puzzle.difficulty.toUpperCase() ?? difficulty.toUpperCase()} · 9 × 9</span><span className="eyebrow">{s.loading ? 'GENERATING…' : game?.completed ? 'PUZZLE COMPLETE' : paused ? 'PAUSED' : 'YOUR NEXT MOVE'}</span></div>
      <div className="board-and-stats"><div className="board-column"><div className="board-stage">
        {game && !s.loading ? <div className="board-interaction" inert={paused}><Board /></div> : <div className="board-placeholder" role="status"><span className="loading-grid"><i /><i /><i /><i /></span><p>Finding your next challenge…</p></div>}
        {paused && !s.loading && <div className="pause-overlay"><Pause size={32} /><h2>TAKE A BREATHER.</h2><p>Your puzzle can wait.</p><button className="button" onClick={s.resume}><Play size={16} fill="currentColor" /> RESUME GAME</button></div>}
      </div>{game && !s.loading && <Keypad />}
      <p id="board-help" className="board-help"><Keyboard size={14} /> Click a cell, then type 1–9. N toggles notes.</p><p className="move-feedback" role="status">{game && game.values[s.selected] > 0 && !game.puzzle.clues[s.selected] && game.values[s.selected] !== game.puzzle.solution[s.selected] ? 'This number is incorrect. Erase it or try another.' : s.pencil ? 'Pencil notes are on. Enter a number to add or remove a note.' : ''}</p></div>
      <aside className="practice-stats"><div className="section-heading"><h2>{game?.puzzle.difficulty.toUpperCase() ?? difficulty.toUpperCase()} PUZZLE</h2><button className="icon-button" disabled={!game || game.completed || s.loading} onClick={paused ? s.resume : s.pause} aria-label={paused ? 'Resume game' : 'Pause game'}>{paused ? <Play size={19} /> : <Pause size={19} />}</button></div>
        <span className="badge yellow">SOLO TRAINING</span><div className="timer-block"><span className="eyebrow"><Clock3 size={13} /> ELAPSED TIME</span><Timer /></div>
        <div className="progress-label"><span>{solved} / {total} CELLS</span><span className="blue">{total ? Math.round(solved / total * 100) : 0}%</span></div><progress max={total || 1} value={solved} aria-label="Puzzle progress" />
        <div className="mini-stats"><div><span>MISTAKES</span><strong className={game?.mistakes ? 'red' : ''}>{game?.mistakes ?? 0}</strong></div><div><span>HINTS USED</span><strong>{game?.hints ?? 0}</strong></div></div>
        <div className="practice-stat-actions"><button className="button button-outline" onClick={s.hint} disabled={!game || paused || game.completed || s.loading}><Lightbulb size={17} /> GET A HINT</button><button className="button" onClick={() => game && !game.completed ? setConfirm('new') : newGame()} disabled={s.loading}><Sparkles size={17} /> NEW PUZZLE</button><button className="quiet-button" onClick={() => setConfirm('restart')} disabled={!game || game.completed || s.loading}><RotateCcw size={14} /> RESTART PUZZLE</button></div>
      </aside></div>
    </section><aside className="practice-sidebar"><section className="panel setup-panel"><h2>SET YOUR PACE</h2><label htmlFor="difficulty" className="eyebrow">NEXT PUZZLE DIFFICULTY</label><select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><p>Choose a level, then start a new puzzle. Every puzzle has one unique solution.</p></section>
      <section className="panel keyboard-panel"><h2>HOW TO PLAY</h2><p>Fill every row, column, and 3×3 box with the numbers 1 to 9, without repeating.</p><h3 className="blue">KEYBOARD</h3><dl><div><dt><kbd>1–9</kbd></dt><dd>Enter number</dd></div><div><dt><kbd>↑ ↓ ← →</kbd></dt><dd>Move cells</dd></div><div><dt><kbd>Delete</kbd></dt><dd>Erase cell</dd></div><div><dt><kbd>N</kbd></dt><dd>Pencil notes</dd></div><div><dt><kbd>Ctrl / ⌘ Z</kbd></dt><dd>Undo move</dd></div></dl><p className="hint-note">Hints mark a run as assisted. Pausing hides the board. Leaving this page or switching tabs pauses the clock.</p></section>
      <section className="panel best-panel"><Trophy size={22} className="yellow" /><span className="eyebrow">YOUR PERSONAL BEST</span><strong>{best === null ? 'SET YOUR FIRST' : formatTime(best)}</strong><p>{game?.puzzle.difficulty ?? difficulty} · unassisted · this browser</p><span className="best-count">{s.records.length} {s.records.length === 1 ? 'PUZZLE' : 'PUZZLES'} COMPLETED</span>{s.storageWarning && <p role="status">Browser storage is unavailable. This session’s results will not persist.</p>}</section>
    </aside></div>
    {confirm && <Modal title={confirm === 'new' ? 'A FRESH CHALLENGE?' : 'START OVER?'} onClose={() => setConfirm(null)}><p>{confirm === 'new' ? `Start a new ${difficulty} puzzle? Your current progress will be replaced.` : 'Clear your entries, notes, mistakes, and timer for this puzzle?'}</p><div className="modal-actions"><button className="button button-outline" onClick={() => setConfirm(null)}>KEEP PLAYING</button><button className="button" onClick={() => { if (confirm === 'new') newGame(); else { s.restart(); setConfirm(null) } }}>{confirm === 'new' ? 'NEW PUZZLE' : 'RESTART'}</button></div></Modal>}
    {game?.completed && !dismissedResult && <Modal title="GRID COMPLETE. WELL PLAYED." onClose={() => setDismissedResult(true)}><div className="result-icon"><Check size={32} /></div><p>You solved a unique {game.puzzle.difficulty} puzzle.</p><div className="result-stats"><div><span>TIME</span><strong>{formatTime(s.accumulated)}</strong></div><div><span>MISTAKES</span><strong>{game.mistakes}</strong></div><div><span>HINTS</span><strong>{game.hints}</strong></div></div><p className="result-note">{game.hints ? 'Assisted run recorded. Try without hints to set a personal best.' : 'Your result is recorded in this browser.'}</p><div className="modal-actions"><button className="button button-outline" onClick={() => setDismissedResult(true)}>VIEW BOARD</button><button className="button" onClick={newGame}>PLAY AGAIN</button></div></Modal>}
  </div>
}
