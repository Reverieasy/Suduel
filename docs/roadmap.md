# Practical development roadmap

## Phase 1 — foundation and frontend

Delivered: V2 design inspection, shared tokens and typography, centered wordmark,
responsive navigation, landing page, game modes, how-to-play, feature overview,
account previews, pure Sudoku engine, worker generation, playable guest practice,
notes/erase/undo, conflicts and mistake feedback, keyboard/touch controls,
pause/resume, restart/new puzzle, completion results and local personal bests.

Before declaring the frontend commercially launch-ready: usability testing with
real players, calibrated difficulty beyond clue counts, production host routing,
cross-browser/device QA, active-game persistence, and manual assistive-technology
review. Account previews are intentionally disabled until Phase 2.

## Phase 2 — private Classic Race MVP

Update: implemented and deployed to the existing Suduel backend. Automated
domain/database/UI checks have passed; the real two-account email and multiplayer
test remains user-managed and pending. See [delivery](phase2-delivery.md) and
[test procedure](phase2-testing.md). The exit gate below has not been declared met.

1. Provision local/staging Supabase, configure Auth and callback URLs, add actual
   sign-in, registration, email verification, reset-password and session states.
2. Implement and test normalized schema, RLS, server-only solution storage,
   server commands and audit events from the multiplayer plan.
3. Add room create/join, invitation link/code, two-player seats, ready controls,
   host settings, countdown, and server-started Classic Race.
4. Add own board snapshots, sanitized opponent progress, server timer/outcomes,
   results, mutually accepted rematch, heartbeat/grace and reconnect recovery.
5. Run two-browser, authorization, concurrency and load tests before enabling
   the private-room controls. Validate managed Realtime latency first.

Exit gate: two people can play a complete private race, disconnect/recover, and
rematch, with no solution or opponent entries exposed and no client-chosen result.

## Phase 3 — battle mechanics

Implement versioned rules, one-time reward ledger, secure energy spending,
Fog/Freeze/Scramble/Shield, expiry/reconnect behavior, compact mobile skills,
reduced-motion feedback and best-of-three rounds. Test atomic shield/attack races
and duplicate events. Playtest the proposed costs and timings before balancing.

Exit gate: two players complete best-of-three battles with correct energy and
cleanup under concurrent commands, network interruption, and timer expiry.

## Phase 4 — progression and community

Add server-derived profile statistics and match history, achievement awards,
inventory/equipped cosmetics, friends/invitations, leaderboard presentation based
on real eligible results, and moderated community features. Build reporting,
rate limits, and access boundaries with the feature rather than after release.

Exit gate: durable real player data, fair visual-only cosmetics, tested privacy,
moderation and ownership; no invented feed entries or rankings.

## Phase 5 — ranked and advanced platform

Define and simulate ratings and match fairness, then add ranked queue, tiers
(Bronze through Legend), season resets/rewards and abuse detection. Additional
board sizes need explicit valid rules and generators. Add cosmetic commerce only
after inventory ownership and billing/webhook idempotency have been designed and
tested. No pay-to-win benefits; no real payments in the initial MVP.

Exit gate: reviewed rating rules and season operations, robust match authority,
reliable matching and independently verified payment/inventory reconciliation if
commerce is introduced.
