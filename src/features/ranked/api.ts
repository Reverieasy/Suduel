import { requireBackend } from '../../lib/supabase'

type QueueResult = { status: 'idle' | 'queued' | 'matched' | 'cancelled'; room_code?: string | null; rating?: number | null; opponent_rating?: number | null }
const client = () => requireBackend() as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }
async function call(name: string): Promise<QueueResult> {
  const { data, error } = await client().rpc(name)
  if (error) throw new Error(error.message)
  return data as QueueResult
}
export const enterRankedQueue = () => call('enter_ranked_queue')
export const cancelRankedQueue = () => call('cancel_ranked_queue')
export const rankedQueueStatus = () => call('ranked_queue_status')
