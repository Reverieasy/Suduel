# SUDUEL

**Sudoku, but competitive.** React + TypeScript + Vite, based on the SUDUEL V2
Figma designs. Guest practice, authentication, private Classic Race and Phase 3 Battle are
implemented against the existing Suduel Supabase project.

**The real two-account signup/email and Classic/Battle gameplay acceptance test is still
pending.** You chose to register and verify those accounts manually. No test
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
The connector cannot edit hosted Auth configuration, and no local CLI management
login was available. Email confirmation was verified as enabled.

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
  countdown, server-generated same puzzle, validated moves, hidden opponent
  entries, synchronized timer, results, rematches and reconnect snapshots.
- Atomic database commands, action deduplication, board versions, participant RLS,
  private solution/board storage, and independently scheduled timeout/grace rules.
- Battle Mode: one-time unit energy, Fog/Freeze/Scramble/Shield, transactional
  costs/cooldowns/immunity, authenticated events and best-of-three series.
- Arcade projectiles/impacts, smoke/frost/glitch/shield overlays, unit/combo
  feedback, 29 original local sounds, persistent audio/accessibility settings,
  final-30/10/5-second warnings, intermissions/results and series rematches.

See the [Phase 3 delivery report](docs/phase3-delivery.md) and
[two-player acceptance procedure](docs/phase3-testing.md). Rankings, payments and
community remain future work.

## Routes

`/`, `/play`, `/practice`, `/how-to-play`, `/features`, `/login`, `/register`,
`/forgot-password`, `/reset-password`, `/auth/callback`, `/profile`, `/rooms/new`,
`/room/:code`. Multiplayer/profile routes require a verified authenticated user.

## Verification commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript |
| `npm run lint` | ESLint, no warnings |
| `npm test` | 45 domain/unit/audio tests |
| `npm run test:e2e` | Public/auth/practice regression and responsive UI fixture tests |
| `npm run test:multiplayer` | Optional actual two-account Classic and Battle tests; skips without runtime credentials |
| `npm run check:backend` | Live public Auth settings and unauthorized/private access checks |
| `npm run build` | Typecheck and production bundle in `dist/` |
| `npm run preview` | Serve production build locally |

Browser tests use installed Edge on Windows and Chromium elsewhere. Other systems
can run `npx playwright install chromium`. `PLAYWRIGHT_CHANNEL` selects an installed
supported channel. Layout fixtures are test-only and are not live multiplayer
verification or production application routes.

The database contract suites contain 30 Phase 2 and 68 Phase 3 assertions in
rolled-back transactions with database-only identities. Both passed against the
existing backend. They do not simulate real Auth email delivery or two real
authenticated Realtime clients.

## Supabase deployment

Existing project: **Suduel**, `curftgyefvgakxnmrqye`, in the connected
**Reveries_App** organization. No new project was created.

Applied migrations and server function source are under `supabase/`. Local SQL
migration versions match hosted history. The `start-race` Edge Function is active
and validates actual bearer tokens itself. Its service-role key comes from
Supabase-managed server environment, never the frontend.

The server's pure engine copy must match `src/features/sudoku/engine.ts`;
`check:backend` verifies this before smoke checks. If changing engine rules, copy
the tested source to `supabase/functions/start-race/engine.ts` and redeploy.

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
No frontend deployment has been performed.
