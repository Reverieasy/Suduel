# SUDUEL

**Solve. Attack. Outplay.**

SUDUEL is a competitive Sudoku browser game that brings the pressure and strategy
of an arcade puzzle battle to the classic number grid. Inspired by the multiplayer
mechanics of Tetris Battle, it is designed around two players solving identical
puzzles while tracking each other's progress in real time.

In Battle Mode, completing rows, columns, and boxes earns energy for temporary
attacks against an opponent. Players must balance accurate solving, speed, and
attack timing while preserving the logical integrity of Sudoku.

The goal is a lightweight, responsive experience for desktop and mobile, built
incrementally by a two-person team.

## Project status

**Early development — Phase 1: Foundation.**

The frontend foundation has been initialized locally with React, strict
TypeScript, Vite, Tailwind CSS, the approved design tokens, a locally bundled
Inter font, and a minimal branded start screen. Build, lint, and local smoke
checks passed for that setup.

This GitHub repository currently contains project documentation. The local
application source has not been uploaded to the repository yet. Gameplay,
authentication, and online multiplayer are not implemented, and there is no live
website deployment yet.

The features below describe the planned product.

## Planned game modes

| Mode | Experience |
| --- | --- |
| Practice | Solo Sudoku with difficulty selection, pencil marks, erase controls, and a completion timer. |
| Classic Race | Two players solve the same puzzle without attacks; the first verified completion wins. |
| Battle | Race to solve the puzzle while earning energy and sending temporary attacks. |
| Private Match | Invite a friend through a room code or shareable link, choose Classic or Battle rules, and rematch. |
| Ranked | Future skill-based matchmaking, ratings, rank tiers, and seasonal leaderboards. |

The initial puzzle format is 9×9. A faster 6×6 format is planned as an optional
addition. Multiplayer will support 1v1 first.

## Battle mechanics

- Completing a row, column, or box earns attack energy; each unit rewards energy
  only once per player per match.
- **Fog** temporarily covers a section of the opponent's board.
- **Scramble** temporarily rearranges the opponent's on-screen number buttons.
- **Freeze** and **Shield** are planned for later playtesting.
- Attacks never change the solution, alter original clues, or permanently remove
  correct values.
- Opponent progress is visible during competitive matches; their entered numbers
  remain hidden until the match concludes.

Move validation, energy, attacks, timers, and match results will be controlled by
the server. Proposed costs, durations, and scoring rules remain subject to testing
and balancing.

## Player features planned for later phases

- Player profiles, avatars, match history, and statistics.
- XP, levels, achievements, and unlockable titles.
- A **Locker** for board skins and profile cosmetics.
- Competitive ratings, seasonal rankings, and leaderboards.
- Friends, match invitations, and a moderated community feed.
- A cosmetic shop with no paid gameplay advantages; real payments are outside
  the initial MVP.

## Technology

| Area | Stack | Status |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | Initialized locally |
| Styling | Tailwind CSS, Inter Variable | Configured locally |
| Code quality | ESLint, TypeScript strict mode | Configured locally |
| UI and state | shadcn/ui, Lucide React, Zustand, React Router, Motion | Planned as needed |
| Backend | Supabase PostgreSQL, Auth, Realtime, Storage, Edge Functions | Planned |
| Testing | Vitest, React Testing Library, Playwright | Planned with feature implementation |
| Hosting and collaboration | Vercel, Supabase, GitHub, Figma | Planned deployment and design workflow; GitHub repository created |

The Sudoku engine will be pure TypeScript, independent of React. The board will
use React components and CSS Grid. The multiplayer architecture will use validated
server state, Realtime Broadcast for accepted match events, and Presence for
connection status.

## Visual direction

A minimalist arcade interface with dark navy surfaces, clear typography, sharp
Sudoku grids, thin borders, and restrained animation.

| Purpose | Color |
| --- | --- |
| Main background | `#0B1422` |
| Secondary background | `#111F30` |
| Cards | `#162538` |
| Local player / primary blue | `#2196F3` |
| Opponent red | `#F04452` |
| Energy / accent yellow | `#FFCC33` |
| Success green | `#2EC78A` |
| Primary text | `#F5F7FA` |
| Secondary text | `#94A3B8` |
| Borders | `#2B4057` |

Readability and competitive fairness guide the design. Planned accessibility
features include keyboard controls, visible focus states, touch-friendly inputs,
reduced motion, and status indicators that do not rely on color alone.

## Development roadmap

| Phase | Focus | Status |
| --- | --- | --- |
| 1 — Foundation | Frontend setup, website layout, Sudoku engine, and playable local Practice Mode | In progress; setup completed locally |
| 2 — Multiplayer Core | Private rooms, synchronized matches, results, rematches, and reconnection | Planned |
| 3 — Battle System | Energy, combos, Fog, Scramble, cooldowns, and effect expiration | Planned |
| 4 — Identity and Progression | Profiles, XP, achievements, titles, skins, and Locker | Planned |
| 5 — Competitive Platform | Matchmaking, ratings, ranked validation, and seasonal leaderboards | Planned |
| 6 — Community and Monetization | Friends, moderated social features, and secure cosmetic purchases | Planned |

The first milestone is a fully playable local Sudoku experience. Ranked play and
later platform features follow only after the core game and match reliability
have been tested.

## Local frontend development

These commands apply to the existing local frontend workspace, where
`package.json` and `package-lock.json` are present. They will apply to a repository
checkout once the application source is uploaded.

Use **Node.js 24 LTS** and **npm**:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. In Windows PowerShell, use `npm.cmd` instead
of `npm` if the execution policy blocks `npm.ps1`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run typecheck` | Check TypeScript |
| `npm run lint` | Run ESLint with no warnings allowed |
| `npm run build` | Check types and create the production build in `dist/` |
| `npm run preview` | Serve the production build locally |

No environment variables or external service connections are required for the
current frontend foundation.

## Specification and documentation

The [master project specification](SUDUEL_MASTER_SPEC.md) is the source of truth
for game rules, architecture, security requirements, and phase completion criteria.

In the local frontend workspace, `docs/design-system.md` documents token usage,
and `src/styles/index.css` defines the shared theme.

**SUDUEL — Solve. Attack. Outplay.**
