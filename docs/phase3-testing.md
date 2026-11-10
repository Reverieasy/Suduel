# Phase 3: real two-player acceptance

**Pending.** You chose to register and verify two accounts manually. The app
accepts any valid email address and stores no test addresses or passwords in
source. Database and presentation fixtures do not replace this procedure.

First follow [Phase 2 setup](phase2-testing.md) for hosted Auth redirect/SMTP
settings, registration/confirmation, consistent local/LAN/HTTPS origins, and
separate browser profiles or devices. Both users must sign in with verified
accounts. Guest practice and a complete Classic Race should still work.

## Play a Battle

1. Player A opens **Game Modes → Battle Mode → Create Room**. Select Easy and a
   five- or ten-minute time limit for the first test. Copy the invitation for B.
2. B opens it in a separate browser profile, private session or device. Check
   usernames, Battle mode, difficulty and per-round time. Both mark ready; A
   starts. Confirm identical clues, synchronized countdown, score 0–0, energy 0.
3. Solve a row, column and box. Check +1/+1/+2, including simultaneous unit
   completions. All-clue units pay nothing. Energy never exceeds five. At the
   cap, complete another eligible unit, spend energy, erase and refill that unit:
   its reward must not repeat. Check visible unit/combo text and chimes.
4. Try expensive skills before charging enough energy. Buttons explain the
   required/current amounts. Invalid forged requests must also fail; see the
   SQL contract for privileged inspection rather than adding a client cheat mode.
5. A casts Fog. B sees exactly the server-selected 3×3 box concealed for three
   seconds, with smoke and an expiry label. Entries and notes are preserved;
   expiry restores them without moving keyboard focus or resetting selection.
6. A casts Freeze. B cannot enter or erase for 1.5 seconds. It expires locally
   from the server deadline; show the following three seconds of immunity.
   Rapid recasts, stale versions and Frozen move requests must be rejected.
7. A casts Scramble. B's keypad is a permutation of 1–9 for five seconds. Every
   button enters its displayed number; physical digit keys are unchanged. The
   standard order returns on expiry. Do not clear entries, selection or notes.
8. B activates Shield (cost 2). An accepted attack consumes it and is blocked;
   no Fog/Freeze/Scramble effect should be applied. The attacking player still
   pays. Unused shields expire at 15 seconds and cannot stack.
9. Cast simultaneously from both sessions. Compare energy, cooldowns, accepted
   events and active effect IDs/deadlines. Retry the same accepted UUID: no
   second cost, effect, reward, impact or sound. Shared cooldown is one second.
10. Refresh/reconnect during a valid effect. Own board, energy, active effects
    and remaining deadlines restore; old launches/impacts do not replay. Try a
    short network interruption within the grace period. Compare both clients
    after recovery. Slow polling must not extend expired effects.
11. Let the round reach 30/10/5/3/2/1 seconds. Check yellow/red/readable emphasis,
    warning/ticks and no full-screen flashing. At zero, entry stops and the UI
    waits for the server. Verify correct timeout winner or equal-progress draw.
12. Win a round. Both clients show the same result and score, no active attacks,
    and **Ready for next round**. Both agree; either starts the fresh synchronized
    round. Energy/cooldowns/progress reset. Draws replay the same round number.
13. Try 2–0 and 2–1 series. First to two wins takes the series. The profile counts
    one Battle match, not multiple round matches. Test mutually accepted series
    rematch: fresh series, score 0–0, new puzzle and zero energy.
14. Forfeit once during active play and once at intermission. The opponent wins
    the whole series. A completed round result remains unchanged. Test one
    disconnected participant and both disconnected participants beyond the
    45-second detection/grace window, including between rounds.

## Feedback, accessibility and device checks

- Distinguish each accepted launch/impact, shield block, wrong-number cue, unit
  completion, energy/combo, and round/victory/defeat/draw sound. Rejected skill
  requests must never produce a successful hit animation.
- Mute during playback: audio stops. Disable countdown sounds: other game sounds
  remain. Adjust both volumes, reload, and confirm preferences persist. Switch
  tabs while a cue is playing: it stops. Return without replaying old cues.
- Enable reduced motion in the OS and then in the app. Check static emphasis,
  no impact shake/travelling particles/keypad movement, and preserved text/status.
- Keep a cell focused through effect expiry. Use 1–9, arrows, N and Delete;
  inspect Fog's concealed labels with a screen reader. Dialogs trap focus and
  Escape closes them; the clock continues behind menus.
- Test a physical phone and desktop together. Check touch targets, legible
  controls, bottom sheets, keypad mapping, smooth smoke and responsive entry.
  Watch bandwidth/latency during fallback polling. The current automated browser
  suite checks layout behavior; it does not benchmark physical device performance.

## Optional automated real-account run

After manually verifying both accounts, provide these only in the current
process environment (or your private CI secret store), then run:

```powershell
# Supply your own values outside source control:
# SUDUEL_QA_EMAIL_A / SUDUEL_QA_PASSWORD_A
# SUDUEL_QA_EMAIL_B / SUDUEL_QA_PASSWORD_B
npm.cmd run test:multiplayer
```

`tests/multiplayer.live.spec.ts` uses two independent browser contexts. Its Classic
test verifies private rooms, progress privacy, completion, recovery and rematch.
Its Battle test charges both players through legitimate moves, tests Shield,
Freeze, Scramble and Fog, refresh/recovery, a two-win series, rematch and forfeit.
It derives a solution from public clues; it never retrieves server secrets.
Tracing, screenshots and video are disabled for these credential-bearing runs.
Tests skip explicitly when the four runtime values are absent.

For every manual/live run, record date, browser/device, app origin, room code,
observed mode/round score, each relevant outcome and Realtime recovery behavior.
Keep credentials, tokens and confirmation links out of reports and screenshots.
Only mark the live acceptance gate passed after recording successful actual
two-player results.
