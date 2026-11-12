import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Eraser, Pencil, Settings, LogOut, RefreshCw } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { Wordmark } from '../../components/Wordmark'
import { SudokuGrid } from '../sudoku/SudokuGrid'
import { progressPercent, type RoomSnapshot, type BattleBoard } from '../multiplayer/types'
import { BattleHud } from './BattleHud'
import { MatchTimer } from './MatchTimer'
import { NumberPad } from './NumberPad'
import { OpponentBoard } from './OpponentBoard'
import { MistakePressure } from './MistakePressure'
import { BattleFeed } from './BattleFeed'
import { AttackFlights, BattleAnnouncements, PressureTransfers, ScreenEffects } from './ScreenEffects'
import { useFeedback } from './feedback'
import { fogCells, validKeypad, NORMAL_KEYPAD, displayDigit, canonicalDigit } from './rules'
import { audioManager } from '../audio/manager'
import { RowCelebration } from './RowCelebration'

interface Props { snapshot: RoomSnapshot; userId: string; now: number; busy: boolean; online: boolean; connection: string; command: (name: string, payload?: Record<string,string|number|boolean>) => Promise<void>; forfeit: () => void; menu: () => void; resync?: () => void }
export function BattleArena({ snapshot: s, userId, now, busy, online, connection, command, forfeit, menu, resync }: Props) {
  const match = s.match!, board = s.board!, battle = s.battle!
  const me = s.players.find((p) => p.user_id === userId)!, rival = s.players.find((p) => p.user_id !== userId)!
  const own = s.progress.find((p) => p.user_id === userId)!, other = s.progress.find((p) => p.user_id !== userId)!
  const state = battle.players.find((p) => p.user_id === userId)!, rivalState = battle.players.find((p) => p.user_id !== userId)!
  const [selected,setSelected] = useState(() => match.clues.indexOf(0)), [pencil,setPencil] = useState(false)
  const [notes,setNotes] = useState<number[][]>(() => Array.from({length:81},() => [])), [rivalView,setRivalView] = useState(false)
  useEffect(() => { document.documentElement.dataset.battleArena='true'; return () => { delete document.documentElement.dataset.battleArena } }, [])
  const effects = useMemo(() => battle.effects.filter((e) => !e.consumed_at && Date.parse(e.expires_at)>now),[battle.effects,now])
  const localEffects = useMemo(() => effects.filter((e) => e.target_id===userId),[effects,userId])
  const remoteEffects = useMemo(() => effects.filter((e) => e.target_id===rival.user_id),[effects,rival.user_id])
  const fog = localEffects.find((e) => e.skill==='fog')
  const fogRegion = fog ? fog.region ?? null : undefined
  const hiddenCells = useMemo(() => new Set(fogCells(fogRegion)),[fogRegion])
  const scrambled = localEffects.find((e) => e.skill==='scramble')?.keypad
  const localMapping = useMemo(() => validKeypad(scrambled), [scrambled])
  const remoteScramble = remoteEffects.find((e) => e.skill==='scramble')?.keypad
  const remoteMapping = useMemo(() => validKeypad(remoteScramble), [remoteScramble])
  const shownClues = useMemo(() => match.clues.map((n) => displayDigit(n,localMapping)), [match.clues,localMapping])
  const shownEntries = useMemo(() => board.entries.map((n) => displayDigit(n,localMapping)), [board.entries,localMapping])
  const shownNotes = useMemo(() => notes.map((values) => values.map((n) => displayDigit(n,localMapping)).sort()), [notes,localMapping])
  const frozen = localEffects.some((e) => e.skill==='freeze'), recovering = Date.parse(state.input_recovery_until ?? '')>now
  const countdown = Math.max(0,Math.ceil((Date.parse(match.started_at)-now)/1000)), ended = now>=Date.parse(match.ends_at)
  const disabled = busy||!online||countdown>0||ended||frozen||recovering
  const wrongCells = useFeedback((store) => store.pulses.filter((p) => p.matchId===match.id&&p.kind==='wrong'&&p.cell!=null).map((p) => p.cell!).join(','))
  const invalid = useMemo(() => new Set(wrongCells ? wrongCells.split(',').map(Number) : []),[wrongCells])
  const rivalBoard = useMemo<BattleBoard>(() => battle.boards?.find((b) => b.user_id===rival.user_id) ?? {user_id:rival.user_id,clues:match.clues,entries:match.clues,version:0,redacted_cells:[]}, [battle.boards,rival.user_id,match.clues])
  const shownRival = useMemo(() => ({ ...rivalBoard, clues:rivalBoard.clues.map((n) => displayDigit(n,remoteMapping)), entries:rivalBoard.entries.map((n) => n===null ? null : displayDigit(n,remoteMapping)) }), [rivalBoard,remoteMapping])
  const latestMove = (s.events ?? []).filter((e) => e.match_id===match.id&&e.kind==='battle_move'&&e.payload.actor_id===rival.user_id&&now-Date.parse(e.created_at)<800).at(-1)
  const place = useCallback((visibleDigit: number) => {
    if(disabled||match.clues[selected])return
    const digit = canonicalDigit(visibleDigit,localMapping)
    if(pencil&&digit>0&&!board.entries[selected]) { setNotes((current) => current.map((values,index) => index===selected ? values.includes(digit) ? values.filter((n) => n!==digit) : [...values,digit].sort() : values)); return }
    if(board.entries[selected]===digit)return
    setNotes((current) => current.map((values,index) => index===selected ? [] : values))
    void command('move',{match_id:match.id,version:board.version,cell:selected,digit})
  },[disabled,match,board,selected,pencil,command,localMapping])
  const select = useCallback((cell: number) => { if(cell!==selected)audioManager.play('select'); setSelected(cell) },[selected])
  const toggle = useCallback(() => setPencil((value) => !value),[])
  const ownPercent = progressPercent(own.correct_cells,match.clues), rivalPercent = progressPercent(other.correct_cells,rivalBoard.clues)
  const rivalOffline = now-Date.parse(rival.last_seen)>15000
  return <div className={`battle-arena-v3${rivalView?' viewing-rival':''}`}>
    <header className="battle-header"><Link to="/" aria-label="SUDUEL home"><Wordmark /></Link><span className="arena-mode">BATTLE · ROUND {match.round_number}</span><span className={`battle-connection ${online?'green':'yellow'}`} role="status">{connection==='live'?'LIVE':online?'SYNCING':'OFFLINE'}</span>{resync&&<button className="icon-button" onClick={resync} aria-label="Resync boards"><RefreshCw size={15}/></button>}<button className="icon-button" onClick={menu} aria-label="Match menu"><Settings size={18}/></button><button className="quiet-button" onClick={forfeit} disabled={busy} aria-label="Leave Battle series"><LogOut size={15}/><span>LEAVE</span></button></header>
    <div className="battle-view-switch" role="group" aria-label="Choose board view"><button aria-pressed={!rivalView} onClick={() => setRivalView(false)}>YOUR GRID · {ownPercent}%</button><button aria-pressed={rivalView} onClick={() => setRivalView(true)}>RIVAL GRID · {rivalPercent}%</button></div>
    <div className="battle-board-arena"><AttackFlights matchId={match.id}/><PressureTransfers matchId={match.id} userId={userId}/>
      <section className="battle-board-panel local-battle-panel" aria-label="Your battle board"><div className="battle-player-heading"><Avatar name={me.username} url={me.avatar_url}/><div><h2>YOU <small>@{me.username}</small></h2><progress max={100} value={ownPercent} aria-label="Your progress"/></div><strong className="blue">{ownPercent}%</strong></div>
        <div className="battle-grid-container"><div className="battle-grid-stack"><SudokuGrid clues={shownClues} values={shownEntries} notes={shownNotes} selected={selected} pencil={pencil} invalid={invalid} hiddenCells={hiddenCells} disabled={disabled} describedBy="battle-input-status" onSelect={select} onPlace={place} onToggleNotes={toggle}/><ScreenEffects effects={localEffects} now={now} matchId={match.id} playerId={userId}/><RowCelebration matchId={match.id} playerId={userId}/>{countdown>0&&<div className="race-countdown" role="status"><strong>{countdown}</strong><span>GET READY</span></div>}</div></div>
        <div className="battle-local-controls"><NumberPad digits={NORMAL_KEYPAD} disabled={disabled} place={place}/><div className="battle-utilities"><button disabled={disabled} aria-pressed={pencil} onClick={toggle}><Pencil size={14}/> NOTES {pencil?'ON':'OFF'}</button><button disabled={disabled} onClick={() => place(0)}><Eraser size={14}/> ERASE</button><span id="battle-input-status" role="status">{recovering?'RECOVERING · 0.5s':frozen?'FROZEN':scrambled?'BOARD DIGITS SHUFFLED':Date.parse(state.freeze_immunity_until ?? '')>now?'FREEZE IMMUNITY':'1–9 · N NOTES · DEL ERASE'}</span></div></div>
        <MistakePressure snapshot={s} playerId={userId} label="Your"/>
      </section>
      <section className="battle-center" aria-label="Match timer and round score"><MatchTimer snapshot={s} now={now} userId={userId}/></section>
      <section className="battle-board-panel rival-battle-panel" aria-label="Opponent battle board"><div className="battle-player-heading"><Avatar name={rival.username} url={rival.avatar_url} opponent/><div><h2>RIVAL <small>@{rival.username}</small></h2><progress max={100} value={rivalPercent} aria-label="Opponent progress"/></div><strong className="red">{rivalPercent}%</strong></div>
        <div className="battle-grid-container"><div className="battle-grid-stack"><OpponentBoard board={shownRival} changedCell={typeof latestMove?.payload.cell==='number'?latestMove.payload.cell:undefined}/><ScreenEffects effects={remoteEffects} now={now} matchId={match.id} playerId={rival.user_id} audible={false}/><RowCelebration matchId={match.id} playerId={rival.user_id} rival/></div></div>
        <div className="rival-status"><strong aria-label="Rival energy">RIVAL ENERGY <b>{rivalState.energy} / {battle.series.rules.maxEnergy}</b></strong><span>{rivalOffline?'CONNECTION INTERRUPTED · GRACE PERIOD':remoteEffects.length?remoteEffects.map((e) => `${e.skill.toUpperCase()} ${Math.max(0,(Date.parse(e.expires_at)-now)/1000).toFixed(1)}s`).join(' · '):'LIVE CONFIRMED ENTRIES · READ ONLY'}</span><small>{battle.series.rules.puzzleAssignment?.startsWith('independent-')?'INDEPENDENT PUZZLES · SAME DIFFICULTY':'LEGACY SHARED PUZZLE'}</small></div>
        <MistakePressure snapshot={s} playerId={rival.user_id} label="Rival"/>
      </section>
    </div>
    <BattleHud snapshot={s} userId={userId} now={now} disabled={busy||!online||countdown>0||ended} cast={(skill) => void command('cast',{match_id:match.id,skill,battle_version:state.version})}/>
    <div className="battle-notification-line"><BattleAnnouncements matchId={match.id}/><span className="compact-arena-notice">COMPACT VIEW · SCROLL THE BOARD PANEL IF NEEDED</span></div>
    <BattleFeed snapshot={s} userId={userId}/>
  </div>
}
