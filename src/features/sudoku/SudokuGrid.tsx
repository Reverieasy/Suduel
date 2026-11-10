import { useRef, type KeyboardEvent } from 'react'
import { sameUnit } from './engine'

interface Props {
  clues: number[]; values: number[]; notes: number[][]; selected: number; pencil: boolean
  invalid: Set<number>; disabled?: boolean; describedBy?: string
  onSelect: (index: number) => void; onPlace: (digit: number) => void; onToggleNotes: () => void; onUndo?: () => void
}
export function SudokuGrid({ clues, values, notes, selected, pencil, invalid, disabled = false, describedBy = 'board-help', onSelect, onPlace, onToggleNotes, onUndo }: Props) {
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  function onKey(event: KeyboardEvent) {
    if (disabled) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && onUndo) { event.preventDefault(); onUndo(); return }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const arrows: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }
    if (event.key in arrows) {
      event.preventDefault()
      const next = Math.max(0, Math.min(80, selected + arrows[event.key]))
      onSelect(next); cells.current[next]?.focus()
    } else if (/^[1-9]$/.test(event.key)) { event.preventDefault(); onPlace(Number(event.key)) }
    else if (['Backspace', 'Delete', '0'].includes(event.key)) { event.preventDefault(); onPlace(0) }
    else if (event.key.toLowerCase() === 'n') { event.preventDefault(); onToggleNotes() }
  }
  return <div className={`sudoku-board${pencil ? ' pencil-mode' : ''}`} role="grid" aria-label="Sudoku puzzle" aria-describedby={describedBy} aria-disabled={disabled} onKeyDown={onKey}>
    {Array.from({ length: 9 }, (_, row) => <div role="row" className="sudoku-row" key={row}>{Array.from({ length: 9 }, (_, col) => {
      const index = row * 9 + col, value = values[index], given = !!clues[index], bad = invalid.has(index)
      const classes = ['sudoku-cell', given ? 'given' : 'entered', selected === index ? 'selected' : sameUnit(selected, index) ? 'related' : '', value > 0 && value === values[selected] ? 'matching' : '', bad ? 'invalid' : '', col === 2 || col === 5 ? 'box-right' : '', row === 2 || row === 5 ? 'box-bottom' : ''].filter(Boolean).join(' ')
      const label = `Row ${row + 1}, column ${col + 1}, ${value ? `${value}${given ? ', fixed clue' : ''}` : `empty${notes[index].length ? `, notes ${notes[index].join(', ')}` : ''}`}${bad ? ', incorrect' : ''}`
      return <div role="gridcell" aria-selected={selected === index} aria-invalid={bad || undefined} key={index} className="cell-wrapper"><button ref={(element) => { cells.current[index] = element }} className={classes} aria-label={label} aria-disabled={disabled} tabIndex={index === selected ? 0 : -1} onClick={() => onSelect(index)} onFocus={() => onSelect(index)}>
        {value || <span className="cell-notes" aria-hidden="true">{Array.from({ length: 9 }, (_, n) => <span key={n}>{notes[index].includes(n + 1) ? n + 1 : ''}</span>)}</span>}
      </button></div>
    })}</div>)}
  </div>
}
