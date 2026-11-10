import { Link } from 'react-router'
import { ArrowRight, Grid3X3, LockKeyhole, Play } from 'lucide-react'

const modes = [
  { title: 'CLASSIC RACE', image: 'race', color: 'blue', description: 'Race a friend on the same Sudoku puzzle.', phase: 'PRIVATE 1V1' },
  { title: 'BATTLE MODE', image: 'battle', color: 'red', description: 'Solve your puzzle and send attacks to slow opponents.', phase: 'PHASE 03' },
  { title: 'PRIVATE MATCH', image: 'private', color: 'yellow', description: 'Create a room or join an invitation.', phase: 'PRIVATE 1V1' },
  { title: 'RANKED', image: 'ranked', color: 'muted', description: 'Climb the ranks and prove your skills.', phase: 'PHASE 05' },
]

export function Modes() {
  return <div className="container page-content"><header className="page-heading centered"><span className="eyebrow blue">FIND YOUR CHALLENGE</span><h1>CHOOSE A MODE</h1><p>Solve. Compete. Outsmart.</p></header>
    <section className="practice-banner"><div className="practice-banner-icon"><Grid3X3 size={32} /></div><div><span className="eyebrow green">AVAILABLE NOW · NO ACCOUNT NEEDED</span><h2>PRACTICE MODE</h2><p>Your grid. Your pace. Sharpen your skills before the battle.</p></div><Link to="/practice" className="button"><Play size={16} fill="currentColor" /> START PRACTICING</Link></section>
    <div className="mode-grid">{modes.map((mode) => <article key={mode.title} className={`mode-card accent-${mode.color}`} id={mode.image === 'private' ? 'private-match' : undefined}>
      <img src={`/figma/${mode.image}.svg`} width="50" height="50" alt="" className="mode-icon" /><h2>{mode.title}</h2><p>{mode.description}</p>
      {mode.phase === 'PRIVATE 1V1' ? <Link to="/rooms/new" className="mode-meta mode-play-link"><img src="/figma/players.svg" width="18" height="18" alt="" /><span>PLAY A FRIEND</span><img src="/figma/arrow.svg" width="20" height="20" alt="" /></Link> : <div className="mode-meta"><img src="/figma/lock.svg" width="18" height="18" alt="" /><span>COMING SOON</span><span>{mode.phase}</span></div>}
    </article>)}</div>
    <section className="panel roadmap-callout"><LockKeyhole size={24} className="yellow" /><div><h2>CLASSIC FIRST. BATTLE NEXT.</h2><p>Create a private Classic Race with a verified account. Same puzzle, synchronized clock, and server-confirmed results. Battle skills and ranked play remain in development.</p></div><Link className="text-link" to="/rooms/new">CREATE OR JOIN <ArrowRight size={16} /></Link></section>
  </div>
}
