import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { generatePuzzle } from './engine.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return reply({ error: 'POST required.' }, 405)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply({ error: 'Sign in to start a match.' }, 401)
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  // Own authentication is required: the legacy gateway verifier does not accept all current JWT signing algorithms.
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user?.email_confirmed_at) return reply({ error: 'A verified account is required.' }, 401)
  try {
    const input = await request.json()
    if (typeof input.code !== 'string' || !/^[A-F0-9]{8}$/.test(input.code) || typeof input.action_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.action_id)) return reply({ error: 'Invalid room or action ID.' }, 400)
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: snapshot, error } = await client.rpc('suduel_command', { p_command: 'snapshot', p_payload: { code: input.code } })
    if (error || !snapshot?.room) return reply({ error: error?.message ?? 'Room not found.' }, 403)
    const room = snapshot.room
    if (room.status !== 'waiting' && room.status !== 'finished') return reply({ error: 'This room already started or closed.' }, 409)
    const puzzle = generatePuzzle(room.difficulty)
    const { data: matchId, error: startError } = await admin.rpc('suduel_start', { p_room: room.id, p_actor: user.id, p_action: input.action_id, p_clues: puzzle.clues, p_solution: puzzle.solution })
    if (startError) return reply({ error: startError.message }, 409)
    return reply({ match_id: matchId })
  } catch { return reply({ error: 'Unable to start this match. Refresh the room and try again.' }, 400) }
})
