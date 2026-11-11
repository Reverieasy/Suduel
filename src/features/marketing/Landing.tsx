import { Link } from 'react-router'
import { ArrowRight, Play, Plus, Zap } from 'lucide-react'
import { Wordmark } from '../../components/Wordmark'
import { HomeAmbience } from '../audio/HomeAmbience'
import type { CSSProperties } from 'react'

function DecorativeBoard({ opponent = false }: { opponent?: boolean }) {
  return <div className={`decorative-board ${opponent ? 'decorative-opponent' : 'decorative-player'}`} aria-hidden="true">{Array.from({ length: 81 }, (_, i) => <span key={i}>{[0, 13, 21, 37, 49, 62, 75].includes(i) ? ((Math.floor(i / 9) * 3 + Math.floor(i / 27) + i % 9) % 9) + 1 : ''}</span>)}</div>
}

const featureCards = [
  { symbol: 'VS', title: 'REAL-TIME RACES', description: 'Go head-to-head with a friend on the same Sudoku puzzle.', color: 'blue', phase: 'PRIVATE CLASSIC RACE' },
  { symbol: 'zap', title: 'SEND ATTACKS', description: 'Complete rows and boxes to charge tactical disruptions.', color: 'red', phase: 'BATTLE / PRIVATE 1V1' },
  { symbol: '2P', title: 'PLAY WITH FRIENDS', description: 'Create a private room and compete with someone you know.', color: 'yellow', phase: 'VERIFIED ACCOUNTS · PRIVATE ROOMS' },
]

export function FeatureCards() {
  return <div className="feature-grid">{featureCards.map((feature) => <article className={`feature-card accent-${feature.color}`} key={feature.title}>
    <div className="feature-symbol">{feature.symbol === 'zap' ? <Zap size={46} strokeWidth={1.8} /> : feature.symbol}</div>
    <h2>{feature.title}</h2><p>{feature.description}</p><span className="feature-line" /><span className="feature-phase">{feature.phase}</span>
  </article>)}</div>
}

export function Landing() {
  return <><section className="hero" aria-labelledby="hero-heading">
    <HomeAmbience />
    <DecorativeBoard /><DecorativeBoard opponent />
    <div className="hero-pixels" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${7 + (i * 17 % 86)}%`, top: `${5 + (i * 31 % 90)}%`, '--drift-x': `${(i%2?1:-1)*(12+i%5*6)}px`, '--drift-y': `${-24-i%6*7}px`, '--drift-time': `${9+i%7*1.5}s`, '--drift-delay': `${-i*1.35}s` } as CSSProperties} />)}</div>
    <div className="hero-content"><span className="eyebrow hero-eyebrow"><i className="status-dot" /> THE NEXT MOVE IS YOURS</span>
      <h1 id="hero-heading"><Wordmark large /></h1><h2>Sudoku, but <span className="blue">competitive.</span></h2>
      <p className="hero-mantra">SOLVE <span>·</span> ATTACK <span>·</span> SURVIVE <span>·</span> OUTPLAY</p>
      <div className="hero-buttons"><Link to="/play" className="button button-large"><Play size={17} fill="currentColor" /> PLAY NOW</Link><Link to="/rooms/new" className="button button-large button-red"><Plus size={19} /> CREATE ROOM</Link></div>
      <Link to="/practice" className="hero-practice">Warm up with free solo practice <ArrowRight size={15} /></Link>
    </div>
  </section><section className="landing-features container" aria-label="The SUDUEL experience"><FeatureCards /></section>
  <div className="landing-note container"><span><span className="status-dot" /> PRACTICE IS LIVE</span><p>Build your speed now. Bring the competition next.</p><Link to="/practice">START TRAINING <ArrowRight size={16} /></Link></div></>
}
