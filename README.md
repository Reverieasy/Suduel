# SUDUEL

**Sudoku, but competitive.** React + TypeScript + Vite, based on the SUDUEL V2
Figma designs. Guest practice, authentication, private Classic Race and the V3 Battle arena are
implemented against the existing Suduel Supabase project.

**Real two-account Classic/Battle gameplay acceptance is still pending.** You confirmed
both accounts are registered and verified and will run the live test. No test
emails or account passwords are hardcoded.

## Run

Use Node 24 LTS and npm:

```sh
npm ci
npm run dev
```

In Windows PowerShell, use `npm.cmd` if needed. The ignored `.env.local` is already
configured with the existing project's public URL/publishable key. New checkouts
can copy `.env.example` and supply:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_URL` (local default `http://localhost:5173`)

**Before testing confirmation/recovery emails**, review the hosted Auth redirect,
SMTP and password settings in the [two-player test guide](docs/phase2-testing.md).
Production Site URL and allowed redirects were configured and checked. Email
confirmation is enabled; cross-device origins must also be allowed as appropriate.

Guest practice still works without backend configuration. Use your real LAN or
HTTPS app origin for cross-device invitations, rather than localhost.

## Implemented

- Responsive V2 landing, centered SUDUEL lettering, locally bundled fonts, shared
  tokens, navigation, guide, mode selection, feature roadmap and error pages.
- Valid uniquely solvable 9x9 guest practice with worker generation, notes,
  erase/undo, keyboard/touch controls, mistakes, hints, pause/restart, results and
  local unassisted personal bests.
- Real registration, email verification/resend, login/logout, persistent session,
  password recovery and protected multiplayer routes.
- Real profile editing, optional avatar, server-controlled Classic/Battle stats and
  recent match history.
- Private create/join/invite rooms, two seats, host settings/readiness, shared
  countdown, validated moves, synchronized timer, results, rematches and reconnect
  snapshots. Classic uses the same puzzle and hides rival entries.
- Atomic database commands, action deduplication, board versions, participant RLS,
  private solution/board storage, and independently scheduled timeout/grace rules.
- Battle Mode: one-time unit energy, Fog/Freeze/Scramble/Shield, transactional
  costs/cooldowns/immunity, authenticated events and best-of-three series.
- Battle V3: two distinct uniquely solvable server-generated puzzles, solver-based
  difficulty matching, actual read-only rival entries/erasures, central timer,
  compact arena, phone board switching, and server-authoritative Mistake Pressure.
- Arcade projectiles/impacts, smoke/frost/glitch/shield overlays, unit/combo
  feedback, 30 original local sounds, persistent audio/accessibility settings,
  final-30/10/5-second warnings, intermissions/results and series rematches.
- Board-digit Scramble (4 energy), Shield (5 energy), and an app-wide ambience
  loop with mute controls and subtle homepage background motion. Reduced motion is
  respected; header/footer wordmarks match the red “EL” of the homepage title.
- Full-board Fog, 3.5-second Freeze, and original arcade row-completion popups
  that celebrate confirmed progress without shifting the arena.
- Animated smoke, crystalline ice and a screen-edge Freeze effect; persistent
  background music across routes and matches; live connected-player counts.
- Private opponent chat, server-verified senders, retry deduplication and rate
  limits; leaderboard account names link to their correct public profiles.
- A persistent Return to game reminder after accidental navigation away from
  an active Classic match or Battle series, without extending reconnect grace.

See the [V3 implementation and verification record](docs/v3-delivery.md) and
[two-player acceptance procedure](docs/v3-testing.md). See also the
[UI, presence, music and chat verification record](docs/ui-social-audio-update.md).
Payments remain future work.

## Routes

`/`, `/play`, `/practice`, `/how-to-play`, `/features`, `/login`, `/register`,
`/forgot-password`, `/reset-password`, `/auth/callback`, `/profile`, `/rooms/new`,
`/room/:code`, `/ranked`, `/leaderboard`, `/players/:username`, `/community`,
`/locker`. Multiplayer/profile routes require a verified authenticated user.

## Verification commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript |
| `npm run lint` | ESLint, no warnings |
| `npm test` | 54 domain/unit/audio tests |
| `npm run test:e2e` | Public/auth/practice regression and responsive UI fixture tests |
| `npm run test:multiplayer` | Optional actual two-account Classic and Battle tests; skips without runtime credentials |
| `npm run check:backend` | Live public Auth settings and unauthorized/private access checks |
| `npm run build` | Typecheck and production bundle in `dist/` |
| `npm run preview` | Serve production build locally |

Browser tests use installed Edge on Windows and Chromium elsewhere. Other systems
can run `npx playwright install chromium`. `PLAYWRIGHT_CHANNEL` selects an installed
supported channel. Layout fixtures are test-only and are not live multiplayer
verification or production application routes.

The Phase 2, Phase 3 and V3 database contracts all pass in rolled-back transactions
with database-only identities. The browser run passes 45 tests and explicitly
skips the two real-account tests when runtime credentials are absent. These checks
do not simulate real Auth email delivery or two real
authenticated Realtime clients.

## Supabase deployment

Existing project: **Suduel**, `curftgyefvgakxnmrqye`, in the connected
**Reveries_App** organization. No new project was created.

Applied migrations and server function source are under `supabase/`. Local SQL
migration versions match hosted history. The `start-race` Edge Function is active
and validates actual bearer tokens itself. Its service-role key comes from
Supabase-managed server environment, never the frontend.

The server's engine and Battle pairing/estimator copies must match
`src/features/sudoku/engine.ts` and `battlePuzzles.ts`; `check:backend` verifies both.
Copy changes to the matching files in `supabase/functions/start-race/` and redeploy.

Future CLI deployments require your own authenticated Supabase CLI. This project
pins CLI 3.1.0; inspect `--help`, target hosted operations explicitly and review
configuration diffs before applying changes. Do not push the entire generated
local config blindly over hosted Auth/SMTP settings.

## Handoff

- [Phase 2 delivery, schema, security and verification](docs/phase2-delivery.md)
- [Two-account/two-device test procedure and required settings](docs/phase2-testing.md)
- [Phase 1 implementation architecture](docs/architecture.md)
- [Design system](docs/design-system.md)
- [Original multiplayer proposal](docs/multiplayer-plan.md)
- [Phased roadmap](docs/roadmap.md)
- [Phase 1 verification record](docs/verification.md)
- [Original master specification](SUDUEL_MASTER_SPEC.md)

Guest practice solutions are intentionally local. Competitive solutions stay in a
non-exposed private schema. Competitive progress/outcomes/statistics are server
controlled; local practice records carry no ranked authority.

Source repository: [Reverieasy/Suduel](https://github.com/Reverieasy/Suduel).
The Supabase resources listed in the delivery report are deployed separately.
The V3 production frontend target is https://suduel.vercel.app; Vercel tracks
deployment status. Real two-player acceptance remains pending after publication.
