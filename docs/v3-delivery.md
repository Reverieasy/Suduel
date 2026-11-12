# V3 Battle arena: implementation and verification

10 November 2026. **Implementation is ready for live acceptance; acceptance is
pending.** Both real accounts are registered and verified according to the user.
The user will run the real two-account test; no such result is claimed here.

## Puzzles and authority

`start-race` generates two independent puzzles for each Battle round using
cryptographic randomness on the server. Both are valid 9×9 puzzles with exactly
one solution, different clues and different solved grids. The existing Classic
path continues generating one shared puzzle with hidden rival entries.

The deterministic `solver-work-v1` estimate counts naked/hidden singles, remaining
search work, branching, backtracks and maximum guess depth. Pairs must have at most
two cells' difference in editable counts, both require guessing or both be solved
logically, and have score difference at most `max(6, 20% of the lower score)`.
Generation checks up to 16 candidates and fails with a retryable start error if no
match is found. This is a bounded heuristic for comparable solving effort, not a
guarantee of identical human solving time.

Private `battle_puzzles` records contain each owner's clues, solution and aggregate
estimate. Only the service role can invoke the start RPC; the database additionally
validates solutions, clue consistency, counts and estimate compatibility. Browser
commands cannot submit a puzzle, solution, mistake count, energy change or target.
The Edge Function authenticates verified bearer tokens before service-role work.

Snapshots return the viewer's clues in `match.clues`, their own confirmed board,
and both Battle boards with immutable clues, confirmed entries and board versions.
Difficulty metadata contains counts only, no solution or trace. Active remote Fog
regions have `null` entries and explicit redacted indices in server snapshots.
Public Realtime events contain action/owner/cell/version metadata, never digits.

Owner-derived move validation checks that owner's solution. Progress, completion
and unit energy also use that puzzle. The opponent grid contains no input controls;
forged ownership/board state cannot bypass the authenticated server command.
Room locks, actor locks, per-board versions and stable action receipts preserve
ordering and prevent duplicate rewards. Participant RLS authorizes event delivery;
events trigger fresh snapshots and reconnects restore both boards. The existing
500 ms Battle polling fallback and five-second reconciliation remain available.

## Pressure and balancing

New series use saved rule version 6. Mistake Pressure defaults:

| Rule | Value |
| --- | --- |
| Pressure break | 3 genuine rejected positive submissions |
| Reward | Rival gains 1 energy |
| Bonus limit | 2 opportunities per source player per round |
| Capacity | 5; overflow discarded, no banked bonus |
| Recovery | 500 ms, enforced server-side |
| Action budget | 8 committed move requests per actor per 1 second |

Given-cell clicks, unchanged digits, empty erases and local notes never add
pressure. Valid erases do not count. Wrong inputs leave board entries/version
unchanged. Stable UUID retries reuse receipts. New UUID guesses against an already
rejected cell revision do not count again, even after unrelated board changes.
Accepting/erasing that cell advances its revision. Genuine mistakes, pressure,
bonus opportunities, actual stored energy and recovery deadlines persist server-side.
All pressure and award counters reset on a new round. Classic awards no mistake
energy. Individual mistakes do not deduct ranked rating; completed Ranked Battle
outcomes determine rating changes.

Changing balancing requires a new `private.battle_config` version. Keep
`DEFAULT_BATTLE_RULES` in sync for guide/fixture defaults; clients render saved
series rules. Existing series retain their saved durations and rule values.
New-series attack durations are Fog **5 s**, Freeze **3.5 s**, Scramble **8 s** and
Shield **20 s**. Scramble costs **4 energy**; Shield costs **5 energy**. Shared
cooldown remains 1 s; post-Freeze immunity remains 3 s. Saved older series retain
their original prices; start a new series for the updated balance.

Fog now conceals all 81 cells, including notes and accessible digit labels, for
both the owner and the rival viewing that board. A null effect region denotes
full-board Fog; saved older box effects remain supported. The server redacts all
remote entries while Fog is active, retains the confirmed private state and
restores the actual entries afterward. A client refresh at the Fog deadline
restores redacted rival values without waiting for periodic polling.

Scramble now remaps the digits displayed on the actual board, including clues,
confirmed entries and local notes. Every digit changes symbol using the same
server-generated permutation on both clients. Keypad order remains 1–9; keyboard
and keypad input are translated from displayed digits back to canonical digits
before the unchanged server move validator. A one-to-one mapping preserves Sudoku
constraints, and expiry restores the original display without modifying any
confirmed cells, progress or rewards. The legacy effect field `keypad` carries
this mapping; no puzzle solution is included.

## Arena and feedback

Desktop presents equal-size live boards with the timer and round score centered
between players. The skill dock and both pressure meters remain in view. Phones
switch between own and actual rival board; the timer remains above the active
board. Short screens show an explicit compact notice and scroll the board panel.
Menus retain focus handling and keep the server clock running.

Genuine mistakes flash the selected cell red and buzz. At 2/3, the meter gently
pulses. A break shows `MISTAKE ×3` / `OPPONENT +1 ENERGY`, a distinct original
pressure-break sound and red-to-yellow transfer particles. Capped/limited awards
describe the actual outcome. Accepted events populate the internally scrolling
live feed. Attacks and persistent effects render on the appropriate actual board
for both players. System/app reduced-motion settings disable travel and pulses.
Server-confirmed row completions also show a short, non-interactive arcade popup:
“LOGIC SURGE!”, “PERFECT LINE!”, “GRID GENIUS!”, “NUMBER NOVA!” or “SHARP SOLVE!”.
Multi-unit completions use “LOGIC COMBO!” or “GRID OVERDRIVE!”. The popup sits
over the relevant player's board without changing layout, uses actual stored
energy in its detail, and does not replay historical or duplicate events.
Reduced motion keeps static text and disables the popup travel and sparks.

The local pack contains 30 effects plus one original 12-second homepage ambience
loop (approximately 1.06 MB total). Music starts after user interaction, has a
persisted toggle, follows master mute/volume, pauses in hidden tabs and stops when
leaving the homepage. Only background pixels and decorative boards animate; the
content stays fixed and reduced-motion settings stop the background movement.
All wordmarks now render “EL” red, including the header and footer.

## Verification record

| Check | Result |
| --- | --- |
| TypeScript, ESLint, production bundle | Pass |
| Unit/domain/audio | 54 passed; includes 18 generated pairs across all three tiers, uniqueness, valid solutions, estimator reproducibility and rejection of unmatched/duplicate pairs |
| Pair-generation stress check | 300 additional pairs across all tiers, zero failures |
| Browser regression | 42 passed; 2 live-account tests explicitly skipped without credentials |
| V3 browser behavior | Rival confirmed entries/erase/reload/Fog redaction, read-only grid, pressure recovery/break/feed/transfer/reset presentation, reduced motion and compact dock |
| Layout screenshots inspected | 1366×768 desktop and 390×844 phone; automated bounds also checked at 1920×1080, 1600×900, 1440×900 and 768×1024 |
| Database contracts | Phase 2, saved-v1 Phase 3 and V3 suites all pass in rolled-back transactions |
| V3 SQL authority | Independent owner solutions, server recovery, UUID and unchanged-cell deduplication, exact rate limit, reward/energy caps, round reset, opponent snapshot synchronization, Fog redaction, unauthorized operations and Classic preservation |
| Privileges/Realtime | Browser start/private puzzle access/energy writes denied; service start permitted; private RLS enabled; only `public.match_events` published, authorized by participant membership |
| Public backend smoke | Confirmations enabled; anonymous commands/start denied, private schema hidden, both server-source copies identical to tested sources |
| Security advisor | No new findings; existing leaked-password-protection Auth warning remains |
| Real authenticated pair | **Pending user-run test; not passed or complete** |

Applied to existing project `curftgyefvgakxnmrqye`:

- `20261110134417_battle_arena_v3_pressure.sql`
- `20261110135800_longer_battle_effects.sql`
- `20261110140820_solver_matched_battle_puzzles.sql`
- `20261110220535_board_scramble_energy_costs.sql`
- `20261112081339_full_board_fog_freeze_balance.sql`
- Updated `start-race` Edge Function, version 3, active.

The frontend release target is https://suduel.vercel.app. Follow
[V3 live testing](v3-testing.md) before recording acceptance. Publication does not
pass the real two-player acceptance gate. Older Phase 3 documents describe the original version;
this document supersedes their Battle puzzle visibility, durations and arena layout.
