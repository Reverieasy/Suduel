# SUDUEL implementation architecture

Phase 2 has since been implemented against the existing Supabase project. See
[phase2-delivery.md](phase2-delivery.md) for the current server architecture and
[phase2-testing.md](phase2-testing.md) for the pending user-managed live test.
The Phase 1 notes below document the original guest-practice boundary.

## Current delivery: Phase 1

This is the local React application in the supplied workspace. No hosted Site,
database, authentication service, or multiplayer service has been created or
modified. The original master specification remains in `SUDUEL_MASTER_SPEC.md`.
The latest attached brief takes precedence where it differs from that file.

### Routes

| URL | Behavior |
| --- | --- |
| `/` | V2 landing page; Play opens mode selection; Create Room opens the clearly marked private-match preview |
| `/play` | Available guest practice and noninteractive Coming Soon multiplayer cards |
| `/practice` | Fully local 9×9 Sudoku practice |
| `/how-to-play` | Practice instructions and explicitly future battle rules |
| `/features` | Feature overview and five-phase development roadmap |
| `/login`, `/register` | Account UI previews, disabled inputs and submission, explanation, working guest-practice link |
| Other paths | Accessible 404 page |

Later platform screens are omitted from primary navigation. No invented player
counts, player ranks, opponents, accounts, matchmaking, or payment flows are used.

### Source boundaries

```text
src/
  app/Shell.tsx                 navigation, route focus, document titles, footer
  components/                  shared wordmark and native-dialog modal
  features/
    marketing/                 landing, mode selection, guide, roadmap, 404
    auth/                      truthful account interface previews
    sudoku/
      engine.ts                pure generation, uniqueness, conflicts, completion
      game.ts                  pure input, notes, history, mistakes, time helpers
      generator.worker.ts      off-main-thread puzzle generation
      store.ts                 practice session and worker lifecycle, Zustand
      statistics.ts            versioned local records, storage error handling
      Board.tsx                grid semantics, roving focus, keyboard input
      Practice.tsx             practice screen and controls
  styles/index.css             V2 tokens, components, responsive layouts
tests/practice.spec.ts          browser user flows and responsive checks
```

The practice route is loaded separately. Fonts and Figma icons are bundled
locally. CSS provides lightweight transitions and a reduced-motion override;
Motion is deferred until actual multi-element battle transitions justify it.
Tailwind's existing Vite integration is retained; shared classes also use the
same CSS theme variables directly.

### Sudoku correctness

The generator permutes digits, row bands, rows within bands, column stacks, and
columns within stacks of a valid solved 9×9 grid. This preserves every Sudoku
constraint. It then removes clues in shuffled order, keeping a removal only when
an MRV backtracking solver finds exactly one solution. `countSolutions` stops at
two to avoid exhausting ambiguous search spaces. Generation runs in a Web Worker
with error handling, a timeout, cleanup, and stale-request protection.

Easy, medium, and hard target 42, 34, and 28 clues. A puzzle can retain more clues
if a removal would break uniqueness. These are clue-density difficulty levels,
not a calibrated human-solving rating. A future generator should rate required
techniques before labeling puzzles for competitive balance. The current pattern
generator provides varied puzzles but does not sample all Sudoku solutions.

Clues cannot be edited. Incorrect local entries are displayed, underlined, and
excluded from correct progress. Peer conflicts are highlighted. Repeating the
same incorrect entry without changing the cell does not add another mistake.
Notes can be toggled; correct placement removes matching peer notes, and undo
restores the previous values and notes. Undo retains mistake and hint totals.
Completion requires a full legal board and locks further entry.

### Timing and persistence

Timing uses accumulated elapsed milliseconds plus the difference between a
start timestamp and the current clock; intervals only refresh the display.
Pausing stops accumulation, hides the puzzle, and makes the underlying board
inert. Switching tabs or leaving practice pauses the session. Returning requires
explicit resume. Generation that finishes after leaving practice stays paused.

Active progress remains in memory across client-side navigation. Reloading starts
a fresh puzzle. Up to 100 completed records are saved under
`suduel.practice.v1` in browser localStorage. Reads validate record fields and
recover from invalid JSON; write failures are reported. Personal bests filter by
difficulty and exclude assisted runs. Records are local, editable by the browser
owner, and have no competitive authority. There is no cross-device sync yet.

### Accessibility and responsive behavior

Native links and buttons, skip link, route focus, visible focus, labeled inputs,
live move feedback, native modal focus containment and Escape dismissal, semantic
grid rows/cells, and a single grid tab stop are implemented. Arrow keys move
selection, 1–9 enter, Delete/Backspace erase, N toggles notes, and Ctrl/Command+Z
undoes. On-screen controls support touch. Clues and entries differ visually;
incorrect entries use text decoration and an accessible label as well as color.

Desktop practice uses board, statistics, and sidebar columns; mobile gives the
board full available width and places statistics below it. Future multiplayer
mobile layouts must use compact opponent progress rather than a second tiny
board. Current browser QA covers 390, 768, 1024, and 1440 pixels.

## Backend boundary for Phase 2

See [multiplayer-plan.md](multiplayer-plan.md). The local engine is reusable pure
TypeScript, but the practice store and its complete solution must never be reused
as the authority for multiplayer. A future multiplayer route receives only clues,
its own confirmed entries, and public opponent progress. The competitive
solution stays on the server until the match is finalized.

## Local operation

Use Node 24 LTS and `npm ci`, followed by `npm run dev`. Windows PowerShell may
require `npm.cmd`. Phase 1 requires no environment variables. `.env.example`
documents future public Supabase configuration; those values are not read yet.

`npm run build` typechecks and creates `dist/`. `npm test` runs domain tests.
`npm run test:e2e` starts Vite, tests with a real browser, then stops its server.
Windows defaults to installed Microsoft Edge. Other systems default to Chromium;
run `npx playwright install chromium` if absent. `PLAYWRIGHT_CHANNEL` can select
an installed supported browser. No deployment was requested for this delivery.

Vite supplies history fallback locally. A production static host must rewrite
application routes to `index.html`, while preserving real asset paths.

## Documentation checked

- [React Router declarative setup](https://reactrouter.com/start/declarative/installation)
- [Vitest setup and Vite/Node requirements](https://vitest.dev/guide/)
- [Supabase access rules](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)

Package versions are captured in `package-lock.json`. See the verification report
for the actual checks and limitations of this delivery.
