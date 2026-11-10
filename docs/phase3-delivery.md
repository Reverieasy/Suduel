# Phase 3 implementation and verification

Implemented on 10 November 2026 against the existing **Suduel** Supabase project
(`curftgyefvgakxnmrqye`). No replacement project, new animation dependency, test
email, or stored account password was introduced. Guest practice and Classic
Race remain available alongside Battle.

**Acceptance remains pending:** the two real verified accounts and live
two-browser/device gameplay test are user-managed, as previously agreed. The
automated tests below establish database and presentation behavior; they do not
establish actual two-account Realtime delivery or measured network latency.

## Battle rules

| Mechanic | Server behavior |
| --- | --- |
| Energy | Starts at 0 each round; maximum 5. Row +1, column +1, box +2. |
| Eligibility | A unit must contain an editable cell and be completely correct. Each unit pays once per player per round. |
| Overflow | Record the completion even at the cap. Overflow is discarded; erasing and re-entering never recovers it. |
| Combos | One move can complete two or three units. Show actual unit count; no reward multiplier. |
| Fog | Costs 1; one server-selected box is concealed for 3 seconds. |
| Freeze | Costs 2; server rejects number entry for 1.5 seconds, then grants 3 seconds of Freeze immunity. Skills can still be cast. |
| Scramble | Costs 2; one server-selected permutation of digits 1–9 lasts 5 seconds. Buttons enter their displayed digit; keyboard digits keep their meaning. |
| Shield | Costs 2; lasts up to 15 seconds and consumes the next valid incoming attack. No stacking. |
| Cast cooldown | Shared 1 second after an accepted cast, including a shield-blocked attack. |
| Results | First complete solution wins the round. At timeout, more confirmed correct entries wins; equal progress draws. |
| Series | First to two round wins. Draws replay the same numbered round with a fresh puzzle and zero energy. Both players must agree before starting the next round. |
| Forfeit | Concedes the entire series, including during intermission. A completed round is never rewritten. |
| Disconnect | Existing 15-second detection plus 30-second grace also applies between rounds. One disconnected player concedes the series; both disconnected players produce an abandoned draw. |
| Statistics | Classic races count once each; Battle series count once each. Individual Battle rounds are not counted as separate matches. |

Each series stores its versioned rules. Changing future configuration does not
change an already-running series. Client constants supply guide defaults only;
accepted mechanics always use the server's saved rules.

## Database and synchronization

Applied migrations (local filenames match hosted migration history):

- `20261110115624_phase3_battle_system.sql`: mode fields, series/scores,
  per-round energy/cooldowns/immunity/counters, active effects, private reward
  ledger/configuration, sanitized event payloads, authoritative command wrappers,
  RLS and restricted grants.
- `20261110122240_phase3_intermission_recovery.sql`: authoritative intermission
  forfeits, disconnect/abandonment handling, and protection against starting a
  series rematch before the current series finishes.

Room locks serialize concurrent move, reward, shield and attack transactions.
Actor/action UUID receipts deduplicate accepted requests; board and battle
versions reject stale actions. The old Classic helper cannot be invoked by a
browser to bypass Freeze. Clients cannot write energy, effects, results or the
reward ledger. Solutions and opponents' entered values remain private.

The existing authenticated participant-scoped `match_events` Realtime stream
triggers complete snapshots. The browser restores current energy, own entries,
effects, server-generated region/permutation, cooldown and immunity deadlines.
One-shot feedback uses stable sequence IDs and bounded deduplication. Initial
history and recovery events older than two seconds do not replay impacts.

Normal heartbeat/reconciliation remains every five seconds. Active Battle
fallback polling is 500 ms while Realtime reconnects, with a slower retry cadence
when offline. Expiry is calculated from server timestamps and midpoint clock
offsets. Requests remain serialized in the client as well as the database.
Polling cannot guarantee delivery of every brief effect on a slow connection;
expired effects are never extended to compensate. The server still enforces
Freeze and determines all results.

## Animation and sound

Inspected Figma V2 motion specifications `50:2`, guide `45:83`, and attack states
`44:1537`, `44:2298`, `44:3069`, `44:3831`. Motion context returned no animation
tracks, so CSS implements the supplied visual states and timing notes.

- Accepted launches travel toward the opponent area in approximately 240 ms.
- Incoming attacks use distinct color, a 300 ms impact ring and six bounded
  particles. Optional impact shake affects only the visual overlay: maximum
  3 px for 180 ms. The playable grid never shakes or remounts for an attack.
- Fog has three drifting cloud shapes over an opaque box; concealed values and
  notes are also removed from accessible labels while the effect is active.
- Freeze adds an icy border/crystals; Scramble adds a short glitch accent and
  250 ms keypad rearrangement; Shield adds a persistent outline and block impact.
- Completed units have directional sweeps, actual combo labels, and energy
  particles toward the meter. Incorrect server-rejected entries get a brief red
  cell cue and distinct sound; the response never supplies the correct digit.
- Mobile uses compact opponent progress, four comfortable skill controls, and
  bottom sheets for the menu, guide and audio settings.
- System or saved reduced-motion preferences disable shake, travel, particles,
  pulses and keypad movement. Static colors, indicators and readable text remain.

The original local sound pack contains **29 WAV assets**, approximately 513 KB
total. It includes selection, accepted/rejected numbers, three unit completions,
energy gain/spend, two combos, skill launch/impact/expiry, shield activation/block,
timer cues and round/win/loss/draw cues. See `public/audio/LICENSE.md` and
`scripts/generate-audio.mjs`; reproduce with `npm run audio:generate`.

Audio initializes after a pointer or keyboard gesture, preloads decoded buffers,
limits overlap to five voices, deduplicates events and rate-limits errors.
Sound, master/effects volume, countdown sounds, motion and shake preferences
persist locally. Mute immediately stops sources; backgrounding stops current
audio. Late loads and disposed contexts cannot replay delayed cues. Gameplay
never waits for audio. Device speaker balance still needs a listening playtest.

## Timer

White during normal play, yellow at 30 seconds with one warning, red at 10 with
one tick per second, stronger controlled emphasis at 5, higher ticks at 3/2 and
a final tone at 1. Countdown sounds have an independent setting. Displayed
seconds and ticks use the same rounded-up server-derived remaining time.

At zero the client stops entry and waits for the authoritative result. Only the
server-confirmed timeout renders **TIME’S UP!** and the result/intermission. The
existing scheduled server resolver runs every five seconds, so confirmation can
briefly follow the visible zero. No client selects a winner.

## Verification evidence

| Check | Result |
| --- | --- |
| TypeScript | Application and browser-test fixtures typecheck. |
| ESLint | Pass, no warnings. |
| Unit/domain/audio tests | 45 passed, including event ordering/deduplication, timer boundaries, keypad validation, original non-silent PCM assets, gesture initialization, overlap, mute and delayed-load cleanup. |
| Phase 2 database contract | All 30 assertions passed again after Phase 3 migrations. |
| Phase 3 database contract | All 68 assertions passed against the existing database in a rolled-back transaction. |
| Browser suite | 25 passed; 2 real-account tests skipped without runtime credentials. |
| Layouts | 390, 768, 1024 and 1440 px; Classic and Battle views, all four effects, intermission/results. Screenshots inspected at mobile and desktop sizes. |
| Interaction | Fog region/expiry/focus, Freeze lock/resume, Scramble button and keyboard mapping/restore, distinct accepted cues, wrong-cell cleanup, reduced motion, persisted settings, browser audio decoding, urgency boundaries and authoritative forfeit confirmation. |
| Backend smoke | Auth settings reachable; confirmations enabled; anonymous command/start requests denied (401), private schema unavailable (406), server engine copy matches. |
| Production bundle | Build passes; local assets included, no added animation library. |

The SQL security tests cover insufficient energy, forged cost/duration/target
fields, duplicate actions, stale versions, cooldown/immunity bypass, repeated
rewards, Frozen moves, unauthorized direct writes, legacy-helper bypass, private
ledger access and outsider effect reads. Series tests cover two wins, draws,
timeouts, a third round, fresh series rematches, forfeits and intermission
disconnects. Database-only identities are rolled back; no email is sent.

The security advisor reports no new schema warnings. Its pre-existing
[leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remains a hosted Auth setting. Performance findings are informational unused
indexes on a project without real match traffic; useful foreign-key indexes
were retained.

## Remaining acceptance and balancing

Follow [phase3-testing.md](phase3-testing.md) with two real accounts. Verify email
delivery/redirects, actual Realtime ordering and latency, simultaneous casts,
recovery during short effects, physical phone responsiveness, perceived sound
balance, and keyboard/screen-reader usability. No load or device performance
benchmark has been claimed. Phase 3's live acceptance gate is not marked complete.

Start playtesting with the requested costs/timings unchanged. Measure time to
first energy, energy discarded at the cap, casts per round, shield block rate,
Freeze/immunity downtime and win rate by first successful attack. If most easy
games finish before tactical interaction, consider puzzle/time-limit tuning
before increasing reward rates. Review the 15-second Shield and 1-second shared
cooldown together; change a versioned server rule only after observing real games.
