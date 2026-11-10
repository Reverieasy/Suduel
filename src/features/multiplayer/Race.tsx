import { useCallback, useMemo, useState } from 'react'
import { Eraser, Pencil, Flag } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { SudokuGrid } from '../sudoku/SudokuGrid'
import { progressPercent, type RoomSnapshot, type RoomPlayer } from './types'
import { BattleHud } from '../battle/BattleHud'
import { AttackFlights, BattleAnnouncements, ScreenEffects } from '../battle/ScreenEffects'
import { MatchTimer } from '../battle/MatchTimer'
import { NumberPad } from '../battle/NumberPad'
import { unitCells, validKeypad } from '../battle/rules'
import { useFeedback } from '../battle/feedback'
import { audioManager } from '../audio/manager'

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
  const effects = useMemo(() => (s.battle?.effects ?? []).filter((e) => e.target_id === userId && !e.consumed_at && Date.parse(e.expires_at) > now), [s.battle?.effects, userId, now])
  const frozen = effects.some((e) => e.skill === 'freeze'), fog = effects.find((e) => e.skill === 'fog'), scramble = effects.find((e) => e.skill === 'scramble')
  const fogRegion = fog?.region
  const hiddenCells = useMemo(() => new Set(fogRegion != null ? unitCells('box', fogRegion) : []), [fogRegion])
  const wrongCells = useFeedback((state) => state.pulses.filter((p) => p.matchId === match.id && p.kind === 'wrong' && p.cell != null).map((p) => p.cell!).join(','))
  const invalid = useMemo(() => new Set(wrongCells ? wrongCells.split(',').map(Number) : []), [wrongCells])
  const disabled = busy || !online || countdown > 0 || remaining <= 0 || frozen
  const myPercent = progressPercent(own.correct_cells, match.clues), rivalPercent = progressPercent(other.correct_cells, match.clues)
  const place = useCallback((digit: number) => {
    if (disabled || match.clues[selected]) return
    if (pencil && digit > 0 && !board.entries[selected]) {
      setNotes((current) => current.map((values, index) => index === selected ? values.includes(digit) ? values.filter((n) => n !== digit) : [...values, digit].sort() : values)); return
    }
    setNotes((current) => current.map((values, index) => index === selected ? [] : values))
    void command('move', { match_id: match.id, version: board.version, cell: selected, digit })
  }, [disabled, match, selected, pencil, board, command])
  const select = useCallback((cell: number) => { setSelected((old) => { if (old !== cell) audioManager.play('select'); return cell }) }, [])
  const toggleNotes = useCallback(() => setPencil((value) => !value), [])
  const offlineFor = now - Date.parse(rival.last_seen)
  const immune = Date.parse(s.battle?.players.find((p) => p.user_id === userId)?.freeze_immunity_until ?? '') > now && !frozen
  return <><MatchTimer snapshot={s} now={now} userId={userId} />
    <div className="opponent-compact"><span className="red">OPPONENT / {rival.username}</span><strong>{rivalPercent}%</strong><progress max={100} value={rivalPercent} aria-label="Opponent progress" /></div>
    {offlineFor > 15000 && <p className="connection-banner" role="status">Your opponent’s connection was interrupted. {Math.max(0, Math.ceil((45000 - offlineFor) / 1000))}s grace remaining. The server will decide the result.</p>}
    <div className="race-arena"><AttackFlights matchId={match.id} /><section className="panel race-panel"><PlayerHeader player={me} percent={myPercent} /><progress max={100} value={myPercent} aria-label="Your progress" />
      <div className="race-grid-wrap"><SudokuGrid clues={match.clues} values={board.entries} notes={notes} selected={selected} pencil={pencil} invalid={invalid} hiddenCells={hiddenCells} disabled={disabled} describedBy="race-board-help" onSelect={select} onPlace={place} onToggleNotes={toggleNotes} /><ScreenEffects effects={effects} now={now} matchId={match.id} />{countdown > 0 && <div className="race-countdown" role="status"><strong>{countdown}</strong><span>GET READY</span></div>}</div>
      <div className="active-skill-indicators" role="status">{effects.map((e) => <span className={`badge skill-${e.skill}`} key={e.id}>{e.skill.toUpperCase()} · {Math.max(0, (Date.parse(e.expires_at) - now) / 1000).toFixed(1)}s</span>)}{immune && <span className="badge purple">FREEZE IMMUNITY</span>}</div>
      <NumberPad digits={validKeypad(scramble?.keypad)} disabled={disabled} place={place} /><div className="race-tools"><button className="button button-outline" disabled={disabled} aria-pressed={pencil} onClick={toggleNotes}><Pencil size={16} /> NOTES {pencil ? 'ON' : 'OFF'}</button><button className="button button-outline" disabled={disabled} onClick={() => place(0)}><Eraser size={16} /> ERASE</button></div><p id="race-board-help" className="board-help">1–9 to enter · arrows to move · N for notes · Delete to erase. {frozen ? 'Frozen: entry resumes when the effect expires.' : scramble ? 'Scrambled keypad: keyboard digits are unchanged.' : 'Entries count after server confirmation.'}</p>
    </section><div className="arena-versus" aria-hidden="true">VS</div><section className="panel race-panel opponent-panel"><PlayerHeader player={rival} percent={rivalPercent} opponent /><progress max={100} value={rivalPercent} aria-label="Opponent progress" /><div className="opponent-board" aria-label="Opponent puzzle preview. Their entered numbers remain hidden.">{match.clues.map((digit, index) => <span key={index} className={`${index % 9 === 2 || index % 9 === 5 ? 'box-right' : ''} ${Math.floor(index / 9) === 2 || Math.floor(index / 9) === 5 ? 'box-bottom' : ''}`}>{digit || ''}</span>)}</div><div className="opponent-summary"><strong>{other.correct_cells} CORRECT ENTRIES</strong><p>Their answers stay hidden. You only see confirmed progress.</p><span className="badge">MISTAKES · {other.mistakes}</span>{s.battle && <p className="rival-energy">RIVAL ENERGY · {s.battle.players.find((p) => p.user_id !== userId)?.energy} / 5</p>}</div></section></div>
    {s.battle && <BattleHud snapshot={s} userId={userId} now={now} disabled={busy || !online || countdown > 0 || remaining <= 0} cast={(skill) => void command('cast', { match_id: match.id, skill, battle_version: s.battle!.players.find((p) => p.user_id === userId)!.version })} />}
    <BattleAnnouncements matchId={match.id} battle={!!s.battle} />
    <div className="race-bottom"><span className="eyebrow">YOUR MISTAKES · {own.mistakes}</span><button className="quiet-button" disabled={busy} onClick={forfeit}><Flag size={14} /> FORFEIT {s.battle ? 'SERIES' : 'MATCH'}</button></div>
  </>
}
