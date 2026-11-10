import { Link, Navigate, useSearchParams } from 'react-router'
import { useAuth } from './store'
import { safeNext } from './validation'

export function AuthCallback() {
  const { session, loading, recovery } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const error = params.get('error_description') ?? new URLSearchParams(window.location.hash.slice(1)).get('error_description')
  if (loading) return <div className="empty-state" role="status">Confirming your session…</div>
  if ((recovery || params.get('recovery') === '1') && session) return <Navigate replace to="/reset-password" />
  return <div className="empty-state"><span className="eyebrow blue">EMAIL VERIFICATION</span><h1>{error ? 'LET’S TRY THAT AGAIN.' : session ? 'YOU’RE VERIFIED.' : 'CHECK YOUR VERIFICATION.'}</h1><p>{error ?? (session ? 'Your account is ready for a Classic Race.' : 'If you opened the email on another device, verification may be complete. Log in to continue, or request a new confirmation link.')}</p><Link to={session ? next : `/login?next=${encodeURIComponent(next)}`} className="button">{session ? 'CONTINUE' : 'LOG IN'}</Link></div>
}
