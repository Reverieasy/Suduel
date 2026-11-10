import { requireBackend } from '../../lib/supabase'
import type { Json } from '../../types/database'
import type { RoomSnapshot } from './types'

export async function roomCommand(command: string, payload: Record<string, Json | undefined>, actionId = crypto.randomUUID()): Promise<RoomSnapshot> {
  const { data, error } = await requireBackend().rpc('suduel_command', { p_command: command, p_payload: payload, p_action_id: command === 'snapshot' ? undefined : actionId })
  if (error) throw new Error(error.message)
  return data as unknown as RoomSnapshot
}

export async function startRace(code: string, actionId = crypto.randomUUID()): Promise<void> {
  const { data, error } = await requireBackend().functions.invoke('start-race', { body: { code, action_id: actionId } })
  if (error) {
    let message = 'Could not start the match. Refresh and try again.'
    try { message = (await error.context.json()).error ?? message } catch { /* Preserve the readable fallback. */ }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
}
