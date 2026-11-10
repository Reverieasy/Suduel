import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './store'
import { backendConfigured } from '../../lib/supabase'

export function RequireAuth() {
  const { loading, session } = useAuth()
  const location = useLocation()
  if (loading) return <div className="empty-state" role="status">Restoring your session…</div>
  if (!backendConfigured || !session || !session.user.email_confirmed_at) return <Navigate replace to={`/login?next=${encodeURIComponent(location.pathname)}`} />
  return <Outlet />
}
