import { useState } from 'react'
import { Eraser, Pencil, Flag } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { SudokuGrid } from '../sudoku/SudokuGrid'
import { DIGITS } from '../sudoku/engine'
import { formatTime } from '../sudoku/game'
import { progressPercent, type RoomSnapshot, type RoomPlayer } from './types'

interface Props { snapshot: RoomSnapshot; userId: string; now: number; busy: boolean; online: boolean; command: (name: string, payload?: Record<string, string | number | boolean>) => Promise<void>; forfeit: () => void }
function PlayerHeader({ player, percent, opponent = false }: { player: RoomPlayer; percent: number; opponent?: boolean }) {
  return <div className="race-player-heading"><Avatar name={player.username} url={player.avatar_url} opponent={opponent} /><div><h2>{opponent ? player.display_name : 'YOU'}</h2><p>@{player.username}</p></div><strong className={opponent ? 'red' : 'blue'}>{percent}%</strong></div>
}

export function Race({ snapshot: s, userId, now, busy, online, command, forfeit }: Props) {
  const match = s.match!, board = s.board!
  const [selected, setSelected] = useState(() => match.clues.indexOf(0))
  const [pencil, setPencil] = useState(false)
  const [notes, setNotes] = useState<number[][]>(() => Array.from({ length: 81 }, () => []))
  const me = s.players.find((p) => p.user_id === userId)!, rival = s.players.find((p) => p.user_id !== userId)!
  const own = s.progress.find((p) => p.user_id === userId)!, other = s.progress.find((p) => p.user_id !== userId)!
  const countdown = Math.max(0, Math.ceil((Date.parse(match.started_at) - now) / 1000))
  const remaining = Math.max(0, Date.parse(match.ends_at) - now)
  const disabled = busy || !online || countdown > 0 || remaining <= 0
  const myPercent = progressPercent(own.correct_cells, match.clues), rivalPercent = progressPercent(other.correct_cells, match.clues)
  async function place(digit: number) {
    if (disabled || match.clues[selected]) return
    if (pencil && digit > 0 && !board.entries[selected]) {
      setNotes((current) => current.map((values, index) => index === selected ? values.includes(digit) ? values.filter((n) => n !== digit) : [...values, digit].sort() : values)); return
    }
    setNotes((current) => current.map((values, index) => index === selected ? [] : values))
    await command('move', { match_id: match.id, version: board.version, cell: selected, digit })
  }
  const offlineFor = now - Date.parse(rival.last_seen)
  return <><div className="race-clock"><span className="eyebrow">CLASSIC RACE · {match.difficulty.toUpperCase()}</span><strong role="timer" aria-label="Match time remaining">{countdown ? `STARTS IN ${countdown}` : formatTime(remaining)}</strong><span className="eyebrow">{remaining <= 0 ? 'SERVER IS CONFIRMING THE RESULT…' : 'ONE GRID. ONE WINNER.'}</span></div>
    <div className="opponent-compact"><span className="red">OPPONENT / {rival.username}</span><strong>{rivalPercent}%</strong><progress max={100} value={rivalPercent} aria-label="Opponent progress" /></div>
    {offlineFor > 15000 && <p className="connection-banner" role="status">Your opponent’s connection was interrupted. {Math.max(0, Math.ceil((45000 - offlineFor) / 1000))}s grace remaining. The server will decide the result.</p>}
    <div className="race-arena"><section className="panel race-panel"><PlayerHeader player={me} percent={myPercent} /><progress max={100} value={myPercent} aria-label="Your progress" /><div className="race-grid-wrap"><SudokuGrid clues={match.clues} values={board.entries} notes={notes} selected={selected} pencil={pencil} invalid={new Set()} disabled={disabled} describedBy="race-board-help" onSelect={setSelected} onPlace={(digit) => void place(digit)} onToggleNotes={() => setPencil((value) => !value)} />{countdown > 0 && <div className="race-countdown" role="status"><strong>{countdown}</strong><span>GET READY</span></div>}</div>
      <div className="number-pad" aria-label="Number controls">{DIGITS.map((digit) => <button key={digit} disabled={disabled} onClick={() => void place(digit)} aria-label={`Enter ${digit}`}>{digit}</button>)}</div><div className="race-tools"><button className="button button-outline" disabled={disabled} aria-pressed={pencil} onClick={() => setPencil(!pencil)}><Pencil size={16} /> NOTES {pencil ? 'ON' : 'OFF'}</button><button className="button button-outline" disabled={disabled} onClick={() => void place(0)}><Eraser size={16} /> ERASE</button></div><p id="race-board-help" className="board-help">1–9 to enter · arrows to move · N for notes · Delete to erase. Entries count after server confirmation.</p>
    </section><div className="arena-versus" aria-hidden="true">VS</div><section className="panel race-panel opponent-panel"><PlayerHeader player={rival} percent={rivalPercent} opponent /><progress max={100} value={rivalPercent} aria-label="Opponent progress" /><div className="opponent-board" aria-label="Opponent puzzle preview. Their entered numbers remain hidden.">{match.clues.map((digit, index) => <span key={index} className={`${index % 9 === 2 || index % 9 === 5 ? 'box-right' : ''} ${Math.floor(index / 9) === 2 || Math.floor(index / 9) === 5 ? 'box-bottom' : ''}`}>{digit || ''}</span>)}</div><div className="opponent-summary"><strong>{other.correct_cells} CORRECT ENTRIES</strong><p>Their answers stay hidden. You only see confirmed progress.</p><span className="badge">MISTAKES · {other.mistakes}</span></div></section></div>
    <div className="race-bottom"><span className="eyebrow">YOUR MISTAKES · {own.mistakes}</span><button className="quiet-button" disabled={busy} onClick={forfeit}><Flag size={14} /> FORFEIT MATCH</button></div>
  </>
}
