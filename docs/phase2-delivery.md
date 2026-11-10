# Phase 2 implementation handoff

Delivered 10 November 2026. **Implementation is ready for the user-managed live
account test; Phase 2 is not declared complete until that test passes.**

## Existing project used

- Organization discovered through the connected Supabase account: `Reveries_App`.
- Existing project: **Suduel**, ref `curftgyefvgakxnmrqye`, region `ap-northeast-1`.
- API URL: `https://curftgyefvgakxnmrqye.supabase.co`.
- No additional project or paid branch was created.
- Public URL/publishable key are in ignored `.env.local`; `.env.example` has
  placeholders. There is no service-role credential in application source.

## Implemented

- Actual Supabase email/password registration, confirm-password validation,
  database-enforced case-insensitive username uniqueness and profile creation.
- Email verification messaging/resend, login/logout, persistent sessions and
  restoration, PKCE callbacks, forgot/reset-password routes and protected rooms.
- Real profile display/editing, optional avatar URL, server-derived win/loss/draw,
  playtime/completion totals and recent Classic Race results.
- Private room creation, eight-character invitation codes/links, join-by-code,
  two seats, host settings (difficulty and 3/5/10 minutes), readiness and leaving.
- Realtime room-event subscription with RLS and periodic authoritative snapshots.
  Snapshot refresh also provides authenticated heartbeat and reconnect recovery.
- A server-generated unique 9×9 puzzle, shared future start time and countdown,
  server-confirmed move entry, own board recovery, opponent progress without
  entered digits, server deadline, mistakes and correct-entry totals.
- Deterministic first accepted complete solution, timeout progress/tie policy,
  explicit forfeits, disconnect detection/grace and independent cron finalization.
- Persisted results/stats, request/accept/decline rematches with new match/puzzle
  identity, and preservation of previous results.
- Responsive blue/red arena and compact mobile opponent display using the V2
  Figma references; Phase 1 practice and centered landing lettering preserved.
- Shared `SudokuGrid` presents practice or confirmed multiplayer state without
  requiring a competitive client solution. Practice retains its original rules.

Battle skills/energy, rankings, payments and community features remain outside
this phase and are not enabled.

## Applied schema and server code

Migrations are checked in with versions matching the hosted migration history:

1. `supabase/migrations/20261110111700_phase2_classic_race.sql`
2. `supabase/migrations/20261110112903_phase2_hardening.sql`

Public tables, all with RLS: `profiles`, `player_stats`, `game_rooms`,
`room_players`, `game_matches`, `match_players`, `match_events`.

Private, non-exposed tables with explicit deny policies and no browser table
grants: `match_secrets`, `player_boards`, `action_receipts`, `match_moves`.

Browser entry points:

- `suduel_username_available`: intentionally public username check; no email lookup.
- `suduel_command`: authenticated wrapper over private validated commands.
- `start-race` Edge Function: verifies the bearer token with Auth, requires a
  verified user, generates using the tested pure engine and invokes the
  service-only `suduel_start` entry point.

Elevated implementations stay in `private`, use an empty search path, and check
identity/membership/state. Public command wrappers are SECURITY INVOKER. The
server-only start cannot be called by an authenticated browser role. Edge
gateway `verify_jwt` is false because the function performs its own actual
`auth.getUser(token)` verification; a missing/invalid token is rejected.

`match_events` contains only room/match IDs, a sequence, timestamp and event kind.
It carries neither entered digits nor solutions. Realtime signals cause clients
to fetch their own authorized snapshots. Subscription/reconnect also refreshes,
closing the snapshot/subscription gap; older snapshots cannot replace newer ones.

Commands use UUID action receipts and room-first/match-second locking. Player
entries carry expected board versions. Competitive table writes and stat changes
are not granted to browser roles. Profile update grants only allow display name
and avatar, with owner RLS and a timestamp trigger.

Cron jobs:

- `suduel-match-clock`: every five seconds, resolves deadlines and disconnects;
  also closes expired waiting rooms and prunes seven-day event/receipt data.
- `suduel-cron-history`: daily, prunes this application's old cron job logs.

Both are active; match-clock job runs were inspected and returned `succeeded`.

## Match policy

The first valid full completion serialized by the server wins. At timeout, most
server-confirmed editable cells wins; equal progress draws. An explicit forfeit
awards the other player the win. A heartbeat is refreshed every five seconds;
after 15 seconds without one, the UI reports interruption and a 30-second grace
period. The server acts after 45 seconds without heartbeat, within the next
five-second cron run. Both abandoned players produce a draw. A refresh or tab
change never pauses the match clock. Duplicate tabs share a seat and may receive
stale-version rejection when they edit concurrently; snapshots reconcile them.

## Verification evidence

| Check | Result |
| --- | --- |
| Strict TypeScript / production build | Passed |
| ESLint | Passed |
| Unit/domain tests | 24 passed |
| Browser regression/UI tests | 14 passed |
| Real-account automated test | Intentionally skipped; user will verify accounts manually |
| Database contract tests | 30 assertions passed inside a rolled-back transaction |
| Anonymous mutation RPC | HTTP 401 |
| Anonymous Edge start | HTTP 401 |
| Private-schema REST access | HTTP 406 |
| Runtime package audit | Zero vulnerabilities |
| Security advisors after hardening | No application schema findings; Auth leaked-password warning remains |
| Performance advisor | No missing FK indexes; unused-index informational notices on the new schema |

Database tests exercise case-insensitive usernames, duplicate creation/join/start,
full-room and outsider denial, readiness/host checks, stale and missing versions,
immutable clues, duplicate accepted/rejected moves, private snapshots, real
browser-role table/function grants, owner profile RLS, completion, one-time stats,
terminal-result immutability, rematches, timeout draws and disconnect grace.
Synthetic identities are created solely inside the rolled-back test transaction;
this is not a test of real Auth signup or signed JWT transport. No fixture users
remain. No real account was created by the implementation or automated tests.

Browser coverage retains the full guest-practice completion regression, confirms
real auth fields/local validation and protected-route redirects, and checks public
screens and test-only lobby/race/results/setup fixtures at 390/768/1024/1440px.
Fixture tests are explicitly labeled as UI-only. Desktop/mobile screenshots were
visually reviewed; no document overflow or uncaught browser errors was found.

The opt-in `tests/multiplayer.live.spec.ts` creates two independent browser
contexts and uses only runtime-provided, pre-verified credentials. It exercises
actual backend gameplay; it never substitutes fixture data for the server.

## Configuration and remaining verification

Follow [phase2-testing.md](phase2-testing.md) for exact dashboard URLs, redirect
allowlists, SMTP/password settings and the manual two-device procedure.

Required frontend values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
and `VITE_APP_URL`. Existing local values are configured. Guest practice remains
available without a backend. Set a LAN/HTTPS app URL for other devices; a phone
cannot use the desktop's `localhost` invitation URL.

Hosted email confirmation is already enabled. Hosted redirect allowlists,
server password strength, custom SMTP and leaked-password protection must be
reviewed in the dashboard because neither the available connector nor the local
unauthenticated CLI can change them. Do not blindly push the entire generated
local config onto the hosted project; inspect any configuration diff first.

Still unverified: actual signup/confirmation email delivery, password-reset mail,
two real signed-in clients receiving Realtime updates, production network timing,
simultaneous cross-client races, Safari/Firefox, and real mobile device behavior.
The backend locks and constraints are implemented, but the database test is
sequential; it is not a substitute for a concurrent load test.

Production still needs a hosted frontend with history fallback, a configured
HTTPS origin/Auth redirect list, a suitable mail provider, operational monitoring,
load/abuse testing and a review of PostgreSQL command throughput. No frontend
deployment was requested or performed. No rating changes are calculated.

## Source changes

- `src/lib/supabase.ts`, generated `src/types/database.ts`.
- `src/features/auth/{AuthPage,AuthCallback,RequireAuth,store,validation}`.
- `src/features/multiplayer/{api,types,useRoom,CreateRoom,Lobby,Race,Results,RoomPage}`.
- `src/features/profiles/ProfilePage.tsx`, `src/components/Avatar.tsx`.
- `src/features/sudoku/SudokuGrid.tsx`, adapter `Board.tsx`; original practice
  engine/state semantics preserved.
- `src/{App,main}.tsx`, shell/navigation, modes/landing and shared CSS.
- Supabase migrations, configuration, `functions/start-race/{index,engine}.ts`,
  rolled-back database tests and backend smoke script.
- Auth/unit/browser/layout/live tests; `.env.example`, ignored `.env.local`,
  package/lockfile and docs.

The workspace still has no Git metadata; changes are local and server-side as
described, with no Git commit or push.

## Official references consulted

- [Supabase Auth signup](https://supabase.com/docs/reference/javascript/auth-signup)
- [Password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Redirect allowlists](https://supabase.com/docs/guides/auth/redirect-urls)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database functions](https://supabase.com/docs/guides/database/functions)
- [Realtime database changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Cron scheduling](https://supabase.com/docs/guides/cron/quickstart)
- [CLI v3 changes](https://supabase.com/changelog/supabase-cli-v3)
