# Phase 1 delivery and verification

Verified on 10 November 2026 in the supplied Windows workspace with Node 24.21.0.
This is a local application delivery. No production deployment, Figma write,
Supabase provisioning, Git commit or push was performed.

## Implemented and reviewed

- Inspected actual V2 Figma page hierarchy, editable layer/style context and
  screenshots. Rebuilt the landing, shared shell, typography and design tokens.
- Centered the landing's SUDUEL lettering independently of the decorative pixel
  mark, including the subsequent requested mobile/desktop correction.
- Added routing, mobile navigation, accessible 404, how-to-play, feature roadmap,
  mode selection and clearly disabled account previews.
- Implemented uniquely solvable local 9×9 practice, worker generation, difficulty
  selection, keyboard/touch entry, notes, erase, undo, conflict/mistake feedback,
  hints, progress, timer, pause/resume, restart/new puzzle, completion dialog and
  local unassisted personal bests.
- Added loading, generation failure/retry, confirmation, empty statistics,
  storage-failure feedback and an application error boundary.
- Documented implementation architecture, proposed database/security boundaries,
  genuine multiplayer lifecycle and a phased roadmap.

## Actual results

| Check | Result |
| --- | --- |
| `npm run build` | Passed strict TypeScript compilation and Vite production build |
| `npm run lint` | Passed, no warnings |
| `npm test` | 21 passing tests across 4 test files |
| `npm run test:e2e` | 7 passing browser tests in installed Microsoft Edge |
| Widths | 390, 768, 1024, 1440px; all eight public/error routes checked at each width |
| Browser errors | No uncaught page errors in responsive route checks |
| Layout | No horizontal document overflow at tested widths |
| Images | No missing/broken image assets in tested routes |
| Visual inspection | Desktop/mobile landing and practice screenshots reviewed |
| Runtime dependencies | `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities |

Tests trace the actual guest flow: generate a puzzle in the browser worker,
read the clues, solve independently, enter through the UI, verify notes and
undo, reject edits to clues, pause without elapsed-time change, confirm restart,
complete the grid, show results, reload, and confirm a stored personal best.
Additional browser coverage verifies difficulty/new-puzzle confirmation,
Escape dismissal, hints, route-return pause, mobile navigation and disabled
account previews with working guest-practice navigation.

Domain tests cover 15 generated puzzles across three levels, valid solutions,
unique solutions, malformed boards, row/column/box conflicts, ambiguous and
impossible boards, completion, clue immutability, notes, peer-note cleanup,
undo restoration, mistakes, assistance, timestamp-based timing, worker cleanup,
stale generation responses, off-route generation, timeout recovery, duplicate
completion input, corrupt/blocked storage and history limits.

The React review checked hook cleanup, route focus, worker ownership, state
boundaries, native dialog behavior, lazy practice loading, and lack of secret
configuration in frontend code. The test-owned preview server was stopped after
the checks; `npm run dev` starts your local server when needed.

## Files created or modified

| Area | Paths |
| --- | --- |
| Application | `src/App.tsx`, `src/main.tsx`, `src/app/Shell.tsx` |
| Shared UI | `src/components/Wordmark.tsx`, `Modal.tsx`, `ErrorBoundary.tsx` |
| Public screens | `src/features/marketing/Landing.tsx`, `Modes.tsx`, `InfoPages.tsx`, `src/features/auth/AuthPage.tsx` |
| Sudoku | `src/features/sudoku/engine.ts`, `game.ts`, `generator.worker.ts`, `store.ts`, `statistics.ts`, `Board.tsx`, `Practice.tsx` |
| Tests | Four `src/features/sudoku/*.test.ts` files, `tests/practice.spec.ts`, `vitest.config.ts`, `playwright.config.ts` |
| Theme/assets | `src/styles/index.css`, `public/figma/*.svg`, `index.html` |
| Project | `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `README.md` |
| Handoff | `docs/design-system.md`, `architecture.md`, `multiplayer-plan.md`, `roadmap.md`, `verification.md` |

## Run and configuration

```sh
npm ci
npm run dev
```

Use `npm.cmd` on Windows if PowerShell blocks npm's script shim. No environment
variables are required. `.env.example` reserves public Supabase values for
Phase 2; setting them today does not enable accounts or multiplayer.

## Remaining work and limitations

- Phase 2 authentication and private 1v1 multiplayer are planned, not implemented.
  Disabled previews never submit account details or claim to create rooms.
- Battle energy, attacks, match outcomes, reconnection, progression and ranked
  features are not implemented or tested in this phase. The multiplayer plan
  specifies their required server integration and concurrency gates.
- Practice solutions are local by design. They must not be included in future
  competitive client payloads. Local statistics provide no anti-cheat guarantee.
- Refreshing starts a new active puzzle. Only completed results persist, capped
  at 100 in this browser; blocked storage prevents persistence.
- Difficulty measures clue density, not solving techniques. The generator uses
  valid grid permutations and does not uniformly sample every Sudoku grid.
- Browser QA used Edge/Chromium. Firefox, Safari, real mobile devices, screen
  readers, and production-host routing still need release verification.
- Full `npm audit` reports 10 moderate development-tool advisories arising from
  the existing ESLint/TypeScript ESLint minimatch dependency chain. Runtime audit
  is clean. No forced major tooling downgrade or broad dependency override was
  applied during this implementation.
- The supplied directory has no Git metadata, so no Git diff/commit was available.

See [roadmap.md](roadmap.md) for the next delivery gates.
