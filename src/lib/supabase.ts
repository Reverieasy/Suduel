import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const backendConfigured = !!url && !!key
export const supabase = backendConfigured ? createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  realtime: { params: { eventsPerSecond: 10 } },
}) : null

export function requireBackend() {
  if (!supabase) throw new Error('Multiplayer is not configured. Add the public Supabase URL and publishable key to .env.local. Guest practice remains available.')
  return supabase
}

export function appUrl(path: string): string {
  return new URL(path, import.meta.env.VITE_APP_URL || window.location.origin).toString()
}
