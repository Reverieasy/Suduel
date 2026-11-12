import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { ArrowUpRight, Menu, X, Volume2 } from 'lucide-react'
import { Wordmark } from '../components/Wordmark'
import { useAuth } from '../features/auth/store'
import { AudioSettings } from '../features/audio/AudioSettings'
import { requireBackend } from '../lib/supabase'
import { ReturnToGame } from '../features/multiplayer/ReturnToGame'

const links = [{ to: '/', label: 'Home' }, { to: '/play', label: 'Play' }, { to: '/how-to-play', label: 'How to Play' }, { to: '/features', label: 'Features' }, { to: '/leaderboard', label: 'Leaderboard' }, { to: '/community', label: 'Community' }, { to: '/locker', label: 'Locker' }]

export function Shell() {
  const [menu, setMenu] = useState(false)
  const [soundSettings, setSoundSettings] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { session, profile, loading } = useAuth()
  const [signoutError, setSignoutError] = useState<string | null>(null)
  async function logout() {
    const { error } = await requireBackend().auth.signOut()
    if (error) setSignoutError('Sign-out failed. Please retry.')
    else { setMenu(false); navigate('/') }
  }
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    if (previousPath.current !== location.pathname) { main.current?.focus(); window.scrollTo(0, 0); previousPath.current = location.pathname }
    const name = links.find((l) => l.to === location.pathname)?.label ?? (location.pathname === '/practice' ? 'Practice' : location.pathname === '/how-to-play' ? 'How to Play' : location.pathname === '/features' ? 'Features' : location.pathname === '/login' ? 'Log In' : location.pathname === '/register' ? 'Sign Up' : location.pathname.startsWith('/room') ? 'Private Match' : location.pathname.startsWith('/players/') ? 'Player' : location.pathname === '/profile' ? 'Profile' : location.pathname.includes('password') ? 'Password Recovery' : location.pathname === '/auth/callback' ? 'Email Verification' : 'Page Not Found')
    document.title = `${name} · SUDUEL`
  }, [location.pathname])
  return <div className="app-shell">
    <a href="#main" className="skip-link">Skip to content</a>
    <header className="site-header"><div className="header-inner">
      <Link to="/" className="brand-link" aria-label="SUDUEL home" onClick={() => setMenu(false)}><Wordmark /></Link>
      <nav className="desktop-nav" aria-label="Main navigation">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.to === '/'}>{link.label}</NavLink>)}</nav>
      <div className="header-actions"><button className="icon-button audio-settings-trigger" aria-label="Sound and accessibility settings" onClick={() => setSoundSettings(true)}><Volume2 size={18} /></button>{loading ? <span role="status" className="eyebrow">CONNECTING…</span> : session ? <><Link to="/profile" className="profile-nav-link">{profile?.username ?? 'Profile'}</Link><button className="quiet-button logout-button" onClick={() => void logout()}>LOG OUT</button></> : <><Link to="/login" className="login-link">Log In</Link><Link to="/register" className="button button-small">SIGN UP</Link></>}</div>
      <button className="icon-button mobile-menu-button" aria-expanded={menu} aria-controls="mobile-navigation" aria-label={menu ? 'Close navigation' : 'Open navigation'} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
    </div>{menu && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" onKeyDown={(e) => { if (e.key === 'Escape') setMenu(false) }}>{[...links, ...(session ? [{ to: '/profile', label: 'Profile' }, { to: '/rooms/new', label: 'Private Room' }] : [{ to: '/login', label: 'Log In' }, { to: '/register', label: 'Sign Up' }])].map((link) => <NavLink to={link.to} key={link.to} onClick={() => setMenu(false)}>{link.label}</NavLink>)}</nav>}</header>
    {soundSettings && <AudioSettings onClose={() => setSoundSettings(false)} />}
    {signoutError && <p className="form-error" role="alert">{signoutError}</p>}
    <main id="main" ref={main} tabIndex={-1}><Outlet /></main>
    <ReturnToGame/>
    <footer className="site-footer"><Link to="/" aria-label="SUDUEL home"><Wordmark /></Link><span>One grid. A whole new game.</span><Link to="/practice">Guest practice <ArrowUpRight size={14} /></Link><span className="footer-build">EARLY ACCESS / CLASSIC & BATTLE</span></footer>
  </div>
}
