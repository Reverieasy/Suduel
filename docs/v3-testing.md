# V3 real two-player acceptance — pending

The two accounts are registered and verified according to the user. A successful
real two-account gameplay run has **not yet been recorded**. SQL and browser
fixtures are independent evidence and do not pass this gate.

## Automated run with the verified accounts

From the project directory in Windows PowerShell:

```powershell
.\scripts\test-live.ps1
```

The script prompts for each verified email and hides password input. Values exist
only in that process environment and are restored/cleared afterward. It starts the
local app using the existing `.env.local` public Supabase configuration and runs
`npm.cmd run test:multiplayer -- --workers=1`. Keep the backend pointed at the
existing Suduel project. Close any outdated dev server on port 5173 first.
Do not place account passwords, confirmation URLs, tokens or service keys in
source files, screenshots or chat. Traces, screenshots and video are disabled for
the real-account tests.

Other platforms or existing private CI can set `SUDUEL_QA_EMAIL_A`,
`SUDUEL_QA_PASSWORD_A`, `SUDUEL_QA_EMAIL_B`, `SUDUEL_QA_PASSWORD_B` in the runtime
environment and run `npm run test:multiplayer -- --workers=1`. The two accounts
must be different. Missing credentials explicitly skip the tests; a skip is not
a successful live verification.

The first test checks Classic's shared puzzle, hidden rival entries, reconnect,
completion, rematch and forfeit. The Battle test:

1. Signs in both verified accounts in independent desktop/phone browser contexts.
2. Creates/joins/readies a private Battle and requires both Realtime subscriptions
   to be live. Checks distinct clues/solutions, unique solutions and solver matching
   by solving public clues in test code only.
3. Confirms the opponent grid is read-only and initially displays the actual other
   puzzle. Submits three genuine mistakes and checks unchanged entries, recovery
   and rival energy. Requires authenticated `mistake_pressure` Realtime delivery.
4. Confirms accepted digits and erases appear on the other player's actual board
   in both directions, including the phone rival-view switch. Requires an actual
   `battle_move` WebSocket event, so fallback-only polling cannot pass this step.
5. Charges legitimate unit energy and checks Shield, Freeze, immunity, Scramble
   and Fog. Reloads to check board/pressure/energy recovery without replayed impacts.
6. Completes a two-win series, checks per-round resets, then rematches and forfeits.

Expected console result: **2 passed, 0 skipped**. Share the result summary and any
failure message without account information. Only then update the acceptance
record below. A failed test should be fixed and rerun, never reclassified as a pass.

## Manual two-device check

Use the same app origin in two browser profiles, a private window, or two devices.
For phone testing, run `npm.cmd run dev -- --host 0.0.0.0` and open the host's LAN
address on both devices; use an allowed HTTPS deployment for remote devices.
Set the app URL/allowed Auth redirects for that origin when testing email links.
The production release target is https://suduel.vercel.app. Verify Vercel has
finished deploying the V3 commit before using that origin for acceptance.

1. Both sign in. A creates an Easy Battle with a five- or ten-minute round and
   sends the invitation to B. Both ready and start.
2. Confirm different actual puzzles, a synchronized countdown/timer, and zero
   energy/pressure. Desktop shows equal boards and a central timer. On phone,
   switch RIVAL GRID / YOUR GRID and compare the other player's actual clues.
3. A enters a correct number. Verify the same cell on B's read-only rival board;
   erase and verify it clears. Repeat from B. Refresh both; compare entries,
   progress and round score. Try clicking/typing on the rival board: it cannot edit.
4. On three distinct empty cells, A submits incorrect numbers. Check a red flash,
   buzz, unchanged board and 500 ms recovery each time; the second pressure segment
   pulses. The third shows `MISTAKE ×3` and `OPPONENT +1 ENERGY`, a distinct sound,
   transfer animation and feed event. Confirm B's energy changes once.
5. Retrying an unchanged rejected cell does not add pressure or another bonus.
   Notes, clue clicks, no-ops and erases do not count. Further distinct errors can
   grant only one additional bonus; after the second opportunity no more energy
   is granted this round. A bonus at energy 5 is discarded and consumes its
   opportunity. Fast valid submissions beyond 8 per second are rejected server-side.
6. Charge energy through correct unit completions and compare attacks on both
   actual grids. Fog lasts 5 s, Freeze 2.5 s plus 3 s immunity, Scramble 8 s and
   Shield up to 20 s. Refresh during each effect; old impacts must not replay.
   During Fog, the caster's rival grid must conceal the same region too.
7. Briefly interrupt one device's network, restore it, and compare both boards,
   pressure, energy and active deadlines. Confirm eventual live connection status.
8. Finish a round and start the next together. Both receive fresh distinct matched
   puzzles; pressure, bonus counts and energy start at zero. Test series completion,
   rematch and forfeit. Individual mistakes must not change any ranked rating.
9. Check 1366×768 desktop and a physical phone: timer, skills and board controls
   remain accessible without full-page scrolling. Test both reduced-motion modes,
   audio/mute persistence, keyboard focus and clear short-screen compact notice.
10. Play Classic: identical puzzles, hidden rival entries, and no mistake energy.

Record date/time, commit/build origin, browser/device pair, test outcome, and
Realtime/reconnection observations. Keep credentials and session tokens out.

## Acceptance record

- Accounts registered and verified: **user confirmed**.
- Automated real-account run: **pending**.
- Physical two-device check: **pending**.
- Overall V3 acceptance: **pending; not complete**.
