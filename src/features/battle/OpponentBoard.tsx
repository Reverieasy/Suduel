import { memo } from 'react'
import type { BattleBoard } from '../multiplayer/types'

export const OpponentBoard = memo(function OpponentBoard({ board, changedCell }: { board: BattleBoard; changedCell?: number }) {
  const hidden = new Set(board.redacted_cells)
  return <div className="sudoku-board rival-sudoku-board" role="grid" aria-label="Opponent Sudoku puzzle" aria-readonly="true">{Array.from({length:9},(_,row) => <div className="sudoku-row" role="row" key={row}>{Array.from({length:9},(_,col) => {
    const index = row*9+col, value = board.entries[index], concealed = hidden.has(index)
    return <div role="gridcell" key={col} className={`cell-wrapper ${col===2||col===5?'box-right':''} ${row===2||row===5?'box-bottom':''}`} aria-label={`Row ${row+1}, column ${col+1}, ${concealed ? 'concealed by Fog' : value ? `${value}${board.clues[index] ? ', fixed clue' : ', confirmed entry'}` : 'empty'}`}><span className={`sudoku-cell ${board.clues[index]?'given':'entered'}${changedCell===index?' remote-changed':''}`}>{concealed ? '' : value || ''}</span></div>
  })}</div>)}</div>
})
