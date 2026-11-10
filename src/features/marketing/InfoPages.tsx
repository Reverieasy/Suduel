import { Link } from 'react-router'
import { ArrowRight, CloudFog, Snowflake, Shuffle, Shield } from 'lucide-react'
import { FeatureCards } from './Landing'

export function HowToPlay() {
  return <div className="container page-content"><header className="page-heading"><span className="eyebrow blue">LEARN THE GAME</span><h1>HOW TO PLAY</h1><p>Simple Sudoku rules. A whole new competitive edge.</p></header>
    <div className="instructions-grid">{[
      ['01', 'SOLVE THE GRID', 'Every row, column, and 3×3 box must contain 1 through 9 without repeating. Original clues stay fixed.', 'blue'],
      ['02', 'FIND YOUR RHYTHM', 'Select a cell and choose a number. Use pencil notes to track possibilities, erase to rethink, and undo to step back.', 'yellow'],
      ['03', 'BUILD YOUR SPEED', 'Choose a difficulty and beat your personal best. Mistakes are highlighted. Hints are available, but assisted runs get their own record.', 'red'],
    ].map(([number, title, description, color]) => <article className={`instruction-card accent-${color}`} key={number}><span className="step-number">{number}</span><h2>{title}</h2><p>{description}</p></article>)}</div>
    <section className="panel battle-guide"><div className="section-heading"><h2>YOUR FUTURE BATTLE TOOLKIT</h2><span className="badge">PHASE 03 · COMING SOON</span></div><p>Complete a row or column for +1 energy, or a 3×3 box for +2. Store up to 5. Each unit pays once. Attacks affect the interface; the solution stays intact.</p>
      <div className="skills-grid">{[
        { name: 'FOG', Icon: CloudFog, detail: '1 energy · conceals a box for 3 seconds', color: 'blue' },
        { name: 'FREEZE', Icon: Snowflake, detail: '2 energy · pauses input for 1.5 seconds', color: 'purple' },
        { name: 'SCRAMBLE', Icon: Shuffle, detail: '2 energy · rearranges the keypad for 5 seconds', color: 'orange' },
        { name: 'SHIELD', Icon: Shield, detail: '2 energy · blocks the next attack', color: 'green' },
      ].map(({ name, Icon, detail, color }) => <article key={name}><Icon size={24} className={color} /><h3 className={color}>{name}</h3><p>{detail}</p></article>)}</div><Link to="/practice" className="button">TRY PRACTICE <ArrowRight size={16} /></Link>
    </section>
  </div>
}

export function Features() {
  return <div className="container page-content"><header className="page-heading"><span className="eyebrow blue">BUILT FOR THE NEXT MOVE</span><h1>LOGIC. WITH A RIVAL.</h1><p>The classic puzzle, reimagined as a competitive browser game.</p></header><FeatureCards />
    <section className="panel development-roadmap"><div className="section-heading"><h2>THE ROAD TO THE ARENA</h2><span className="badge green">PHASE 01 · PLAYABLE</span></div><ol>{[
      ['01', 'Foundation & practice', 'Responsive interface, unique Sudoku puzzles, notes, keyboard controls, and local personal bests.', 'Available now'],
      ['02', 'Real multiplayer', 'Verified accounts, private 1v1 rooms, Classic Race, synchronized timers, reconnection, results, and rematches.', 'In verification'],
      ['03', 'Battle mechanics', 'Server-validated energy, Fog, Freeze, Scramble, Shield, and best-of-three battles.', 'Planned'],
      ['04', 'Your player identity', 'Profiles, history, achievements, friends, cosmetics, and community.', 'Planned'],
      ['05', 'Competitive seasons', 'Ranked matchmaking, rating tiers, seasonal rewards, and cosmetic-only purchases.', 'Planned'],
    ].map(([number, title, description, status]) => <li key={number}><span className="roadmap-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="badge">{status}</span></li>)}</ol><Link to="/practice" className="button">MAKE YOUR FIRST MOVE <ArrowRight size={16} /></Link></section>
  </div>
}

export function NotFound() {
  return <div className="empty-state"><span className="eyebrow blue">404 · OUT OF BOUNDS</span><h1>THAT CELL IS EMPTY.</h1><p>The page you’re looking for isn’t on this board.</p><Link to="/" className="button">BACK HOME <ArrowRight size={16} /></Link></div>
}
