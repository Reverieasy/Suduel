import { readFileSync } from 'node:fs'
if (readFileSync('src/features/sudoku/engine.ts','utf8') !== readFileSync('supabase/functions/start-race/engine.ts','utf8')) throw new Error('The server puzzle engine differs from the tested practice engine. Sync and redeploy start-race.')
if (readFileSync('src/features/sudoku/battlePuzzles.ts','utf8') !== readFileSync('supabase/functions/start-race/battlePuzzles.ts','utf8')) throw new Error('The server Battle pairing differs from the tested solver estimator. Sync and redeploy start-race.')
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((line) => line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)] }))
const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY } })
console.log(JSON.stringify({ status: response.status, auth: await response.json() }, null, 2))
const headers = { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }
for (const [name, path, options] of [
  ['anonymous command denied', '/rest/v1/rpc/suduel_command', { method: 'POST', body: JSON.stringify({ p_command: 'create', p_payload: {} }) }],
  ['anonymous start denied', '/functions/v1/start-race', { method: 'POST', body: '{}' }],
  ['private schema hidden', '/rest/v1/match_secrets?select=*', { headers: { 'Accept-Profile': 'private' } }],
]) {
  const result = await fetch(env.VITE_SUPABASE_URL + path, { ...options, headers: { ...headers, ...options.headers } })
  if (result.status < 400) throw new Error(`${name} failed: ${result.status}`)
  console.log(`${name}: HTTP ${result.status}`)
}
