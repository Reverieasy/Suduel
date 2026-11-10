import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type Profile = Database['public']['Tables']['profiles']['Row']
interface AuthState {
  loading: boolean; session: Session | null; profile: Profile | null; error: string | null; recovery: boolean
  refreshProfile: () => Promise<void>
}
export const useAuth = create<AuthState>((set, get) => ({
  loading: !!supabase, session: null, profile: null, error: null, recovery: false,
  async refreshProfile() {
    const id = get().session?.user.id
    if (!supabase || !id) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (get().session?.user.id === id) set({ profile: data, error: error ? 'Your profile could not load. Please retry.' : null })
  },
}))

export function initializeAuth() {
  if (!supabase) return () => {}
  let disposed = false
  let eventVersion = 0
  const accept = (session: Session | null) => {
    if (disposed) return
    useAuth.setState({ loading: false, session, profile: session?.user.id === useAuth.getState().profile?.id ? useAuth.getState().profile : null })
    if (session) queueMicrotask(() => { if (!disposed) void useAuth.getState().refreshProfile() })
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    eventVersion++
    if (event === 'PASSWORD_RECOVERY') useAuth.setState({ recovery: true })
    if (event === 'SIGNED_OUT') useAuth.setState({ recovery: false })
    accept(session)
  })
  const version = eventVersion
  void supabase.auth.getSession().then(({ data, error }) => {
    if (disposed || eventVersion !== version) return
    if (error) useAuth.setState({ error: 'Your session could not be restored. Please sign in again.' })
    accept(data.session)
  }).catch(() => { if (!disposed) useAuth.setState({ loading: false, error: 'Unable to restore your session. Please sign in again.' }) })
  return () => { disposed = true; subscription.unsubscribe() }
}
