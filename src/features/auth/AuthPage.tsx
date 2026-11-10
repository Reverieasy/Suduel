import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { appUrl, backendConfigured, requireBackend } from '../../lib/supabase'
import { useAuth } from './store'
import { registrationError, safeNext } from './validation'

type Mode = 'login' | 'register' | 'forgot' | 'reset'
const titles: Record<Mode, string> = { login: 'WELCOME BACK', register: 'JOIN SUDUEL', forgot: 'FORGOT PASSWORD?', reset: 'A FRESH START.' }
const labels: Record<Mode, string> = { login: 'LOG IN', register: 'CREATE ACCOUNT', forgot: 'SEND RESET LINK', reset: 'UPDATE PASSWORD' }

export function AuthPage({ mode = 'login' }: { mode?: Mode }) {
  const { session, loading } = useAuth()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(search.get('next'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  if (session?.user.email_confirmed_at && !loading && mode === 'login') return <Navigate replace to={next} />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const username = String(fields.get('username') ?? '').trim()
    const password = String(fields.get('password') ?? '')
    const confirmation = String(fields.get('confirmation') ?? '')
    setError(null); setMessage(null)
    if (mode === 'register') {
      const invalid = registrationError(username, email.trim(), password, confirmation)
      if (invalid) { setError(invalid); return }
    }
    if (mode === 'reset' && (password !== confirmation || password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))) { setError('Use matching passwords with at least 10 characters, uppercase, lowercase and a number.'); return }
    setBusy(true)
    try {
      const client = requireBackend()
      if (mode === 'register') {
        const available = await client.rpc('suduel_username_available', { p_username: username })
        if (available.error) throw new Error('Could not check your username. Please try again.')
        if (!available.data) throw new Error('That username is taken. Please choose another.')
        const { error: signupError } = await client.auth.signUp({ email: email.trim(), password, options: { data: { username }, emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(next)}`) } })
        if (signupError) {
          if (signupError.message.includes('Database error')) throw new Error('Your account could not be created. The username may have just been taken; try another.')
          if (signupError.code !== 'user_already_exists' && signupError.code !== 'email_exists') throw new Error('Signup could not be completed. Check your details and try again shortly. If you already have an account, log in or reset your password.')
        }
        setMessage('If this address is eligible, a confirmation email is on its way. Open the link to verify, then log in. If you already have an account, log in or reset your password.')
      } else if (mode === 'login') {
        const { error: loginError } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (loginError) throw new Error(loginError.code === 'email_not_confirmed' ? 'Verify your email before logging in. Check your inbox or resend confirmation below.' : 'Unable to log in. Check your details and email verification, or reset your password.')
        navigate(next, { replace: true })
      } else if (mode === 'forgot') {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('/auth/callback?recovery=1') })
        if (resetError) throw resetError
        setMessage('If an account can receive password recovery at this address, a reset link is on its way. Check your inbox and spam folder.')
      } else {
        const { error: updateError } = await client.auth.updateUser({ password })
        if (updateError) throw updateError
        useAuth.setState({ recovery: false })
        setMessage('Password updated. You can continue to game modes.')
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.') }
    finally { setBusy(false) }
  }
  async function resend() {
    if (!email.trim()) { setError('Enter your email address first.'); return }
    setBusy(true); setError(null)
    try {
      const { error: resendError } = await requireBackend().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(next)}`) } })
      if (resendError) throw resendError
      setMessage('If confirmation is available for this address, an email is on its way.')
    } catch { setError('Could not resend confirmation. Please wait and try again.') }
    finally { setBusy(false) }
  }
  const resetAvailable = mode !== 'reset' || !!session
  return <div className="auth-page"><span className="eyebrow">THE PUZZLE IS JUST THE BEGINNING.</span><section className="auth-card panel">
    <span className="badge blue">{mode === 'register' ? 'YOUR FIRST MOVE' : 'SUDUEL ACCOUNT'}</span><h1>{titles[mode]}</h1>
    <p>{mode === 'register' ? 'Create your player identity. Verify your email to enter the arena.' : mode === 'forgot' ? 'We’ll send you a link to choose a new password.' : mode === 'reset' ? 'Choose a new password for your account.' : 'Log in to race a friend on the same Sudoku puzzle.'}</p>
    {!backendConfigured && <div className="notice" role="status">Supabase is not configured. Guest practice remains available.</div>}
    {!resetAvailable && <div className="notice" role="status">Open the reset link from your email first, or <Link to="/forgot-password">request a new link</Link>.</div>}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <form onSubmit={submit}><fieldset disabled={busy || !backendConfigured || !resetAvailable} className="auth-fields">
      {mode === 'register' && <label>USERNAME<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" placeholder="Choose your name" autoComplete="username" /></label>}
      {mode !== 'reset' && <label>EMAIL ADDRESS<input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>}
      {mode !== 'forgot' && <label>PASSWORD<input name="password" type="password" required minLength={mode === 'login' ? 1 : 10} placeholder={mode === 'login' ? 'Your password' : '10+ characters, uppercase, lowercase, number'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>}
      {(mode === 'register' || mode === 'reset') && <label>CONFIRM PASSWORD<input name="confirmation" type="password" required minLength={10} placeholder="Enter your password again" autoComplete="new-password" /></label>}
      <button className="button" type="submit">{busy ? 'PLEASE WAIT…' : labels[mode]}</button>
    </fieldset></form>
    {mode === 'login' && <div className="auth-secondary"><Link to="/forgot-password">Forgot password?</Link><button className="quiet-button" disabled={busy || !backendConfigured} onClick={resend}>Resend confirmation</button></div>}
    <p className="auth-switch">{mode === 'register' ? 'Already have an account?' : 'New to SUDUEL?'} <Link to={`${mode === 'register' ? '/login' : '/register'}?next=${encodeURIComponent(next)}`}>{mode === 'register' ? 'Log in' : 'Create account'}</Link></p>
    <Link to={mode === 'reset' && session ? '/play' : '/practice'} className="button button-outline">{mode === 'reset' && session ? 'GAME MODES' : 'PLAY AS A GUEST'} <ArrowRight size={16} /></Link>
  </section><p className="eyebrow yellow">GUEST PRACTICE · NO ACCOUNT NEEDED</p></div>
}
