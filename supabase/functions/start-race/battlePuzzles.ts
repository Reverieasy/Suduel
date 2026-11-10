import { conflicts, countSolutions, generatePuzzle, validBoard, type Difficulty, type Puzzle } from './engine.ts'

export type DifficultyEstimate = { method: 'solver-work-v1'; score: number; editableCells: number; nakedSingles: number; hiddenSingles: number; searchNodes: number; guesses: number; backtracks: number; maxGuessDepth: number }
export type BattlePuzzle = Puzzle & { estimate: DifficultyEstimate }
const ALL = [1,2,3,4,5,6,7,8,9]
const UNITS = Array.from({length:27},(_,u) => Array.from({length:9},(_,i) => u<9 ? u*9+i : u<18 ? i*9+u-9 : Math.floor((u-18)/3)*27+(u-18)%3*3+Math.floor(i/3)*9+i%3))
const PEERS = Array.from({length:81},(_,cell) => [...new Set(UNITS.filter((unit) => unit.includes(cell)).flat())].filter((i) => i!==cell))
function candidates(board: number[], cell: number) { return ALL.filter((digit) => !PEERS[cell].some((peer) => board[peer]===digit)) }

/** Deterministic effort estimate; returns counts, never a solution or solving trace. */
export function estimateDifficulty(clues: number[]): DifficultyEstimate {
  if(!validBoard(clues)||conflicts(clues).size)throw new Error('Invalid Sudoku clues.')
  const board=[...clues], metrics: DifficultyEstimate={method:'solver-work-v1',score:0,editableCells:clues.filter((n)=>!n).length,nakedSingles:0,hiddenSingles:0,searchNodes:0,guesses:0,backtracks:0,maxGuessDepth:0}
  for(;;) {
    const options=board.map((n,i) => n ? [] : candidates(board,i))
    if(options.some((digits,i) => !board[i]&&!digits.length))throw new Error('Unsolvable Sudoku clues.')
    const naked=options.findIndex((digits) => digits.length===1)
    if(naked>=0) {board[naked]=options[naked][0];metrics.nakedSingles++;continue}
    let hidden=false
    for(const unit of UNITS) {
      for(const digit of ALL) {
        const cells=unit.filter((i) => !board[i]&&options[i].includes(digit))
        if(cells.length===1){board[cells[0]]=digit;metrics.hiddenSingles++;hidden=true;break}
      }
      if(hidden)break
    }
    if(!hidden)break
  }
  const unresolved=board.filter((n) => !n).length
  function search(depth: number): boolean {
    let cell=-1, options:number[]=[]
    for(let i=0;i<81;i++)if(!board[i]){
      const next=candidates(board,i)
      if(!next.length)return false
      if(cell<0||next.length<options.length){cell=i;options=next}
    }
    if(cell<0)return true
    const branching=options.length>1
    if(branching)metrics.guesses++
    const nextDepth=depth+Number(branching);metrics.maxGuessDepth=Math.max(metrics.maxGuessDepth,nextDepth)
    for(const digit of options){metrics.searchNodes++;board[cell]=digit;if(search(nextDepth))return true;metrics.backtracks++}
    board[cell]=0;return false
  }
  if(!search(0))throw new Error('Unsolvable Sudoku clues.')
  metrics.score=metrics.editableCells+metrics.hiddenSingles*2+unresolved*4+metrics.guesses*30+metrics.backtracks*5+metrics.maxGuessDepth*12
  return metrics
}
export function difficultyMatched(a: DifficultyEstimate,b: DifficultyEstimate): boolean {
  return Math.abs(a.editableCells-b.editableCells)<=2&&(a.guesses>0)===(b.guesses>0)&&Math.abs(a.score-b.score)<=Math.max(6,Math.min(a.score,b.score)*.2)
}
/** Bounded pool; fail rather than silently assigning an unmatched pair. */
export function generateBattlePair(difficulty: Difficulty, random: () => number = Math.random): [BattlePuzzle,BattlePuzzle] {
  const pool:BattlePuzzle[]=[]
  for(let attempt=0;attempt<16;attempt++) {
    const puzzle=generatePuzzle(difficulty,random)
    if(countSolutions(puzzle.clues)!==1)continue
    const candidate={...puzzle,estimate:estimateDifficulty(puzzle.clues)}
    const match=pool.find((other) => other.solution.join(',')!==candidate.solution.join(',')&&other.clues.join(',')!==candidate.clues.join(',')&&difficultyMatched(other.estimate,candidate.estimate))
    if(match)return [match,candidate]
    pool.push(candidate)
  }
  throw new Error('A fair puzzle pair could not be generated. Please retry starting the round.')
}
