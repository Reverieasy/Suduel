# Phase 2: two-player verification procedure

Status: implementation is deployed to the existing Supabase project. You chose
to register and verify the two real test accounts yourselves. That live test is
pending; the automated database and UI tests do not replace it.

## 1. Check the hosted Auth configuration

Open the existing [Suduel URL configuration](https://supabase.com/dashboard/project/curftgyefvgakxnmrqye/auth/url-configuration).

For local testing, set:

- **Site URL:** `http://localhost:5173`
- **Redirect URLs:** `http://localhost:5173/**` and `http://127.0.0.1:5173/**`

These development allowlists cover confirmation, recovery, and preserved invite
targets. For production, use your real HTTPS app URL and constrain allowed
callback paths. `VITE_APP_URL` must match the origin you intend to use for email
links and invitations. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

In Auth settings, keep email confirmations enabled; the project already reported
`mailer_autoconfirm: false`. Set the server password policy to at least 10
characters with uppercase, lowercase and numbers, matching the application.
Enable leaked-password protection if supported by your plan. The latest advisor
reported that this protection was disabled.

The connector used here cannot read or change the full Auth redirect/SMTP/password
configuration, and the local CLI has no management login. The checked-in
`supabase/config.toml` contains the local settings, but it has **not** been pushed
over your hosted Auth configuration.

If you use Supabase's default email service, check its recipient restrictions and
rate limits. Configure your own SMTP provider before general public signup; the
app accepts arbitrary valid email addresses and never hardcodes test recipients.
See [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 2. Start the app

The ignored `.env.local` is configured with this project's public URL and
publishable key. No service-role key is in the frontend.

```powershell
npm.cmd ci
npm.cmd run dev
```

Use `http://localhost:5173` consistently. Vite prints a different port if the
default is occupied; if so, free port 5173 or update the app URL and Auth allowlist.

For two devices on the same LAN, set `VITE_APP_URL` to your development machine's
actual LAN URL, add that origin's `/**` redirect to Supabase, restart Vite with
`npm.cmd run dev -- --host 0.0.0.0`, and open that URL on both devices. The phone
cannot reach the desktop using `localhost`. Clipboard copying may be unavailable
on HTTP LAN URLs; the selectable invitation field remains usable. A real HTTPS
deployment is preferred for broader device testing.

## 3. Register two accounts manually

Use a normal browser profile for Player A and a separate profile/private window
or device for Player B. They must have separate Supabase sessions.

1. On A, open `/register`. Enter a username, your first valid email, password and
   confirmation. Username: 3–20 ASCII letters, digits, underscores. Password:
   10+ characters with uppercase, lowercase and a number.
2. Open the actual confirmation email and verify. Return to `/login` and sign in.
   For PKCE session exchange, open the link in the same browser profile/origin
   that initiated signup. If you verify on another device, log in afterward.
3. Repeat on B with another username and another accessible email address.
4. Refresh both pages. Their separate sessions and profile links should restore.
5. Confirm that entering an already-used username in another case is rejected.
   Existing-email signup messaging should remain generic.
6. Try `/forgot-password` with one account. Open the real recovery email in that
   browser, set a new password, then verify it can log in. This flow is not
   considered verified until you have received and used that email.

Never put actual passwords in tracked source, screenshots or issue reports.

## 4. Play a private Classic Race

1. A opens **Game Modes → Play a Friend** or **Create Room**.
2. Select difficulty and 3, 5 or 10 minutes. Create the room.
3. Copy the invitation, or copy its eight-character code.
4. B opens the link, or enters the code under **Got an Invite?**
5. Both lobbies should show two actual usernames and connection/ready status.
6. Change a setting as host. Both ready states should clear. B must not be able
   to change settings or start a match.
7. Both click **I'm Ready**. A's **Start Match** becomes enabled.
8. A starts. Both clients should show a shared three-second countdown and the
   same clues. Start/deadline timestamps are stored by the server.
9. Enter a known valid answer on A. It appears after confirmation; B's opponent
   percentage should update. B must never see A's entered digits. The desktop
   opponent preview displays original clues only; mobile shows compact progress.
10. Enter an incorrect answer. The server should reject it, keep the confirmed
    board intact, and count one mistake. Notes are local and do not count.
11. Finish correctly. Both clients must agree on the winner and final statistics.
12. A requests a rematch. B accepts. Both should receive a fresh puzzle and clock;
    the previous result remains in **Profile → Recent Classic Races**.

## 5. Recovery and edge cases

| Scenario | Expected result |
| --- | --- |
| Refresh mid-match | Confirmed entries, opponent progress and server deadline restore |
| Switch browser tabs | Match clock continues; there is no practice-style pause |
| Briefly disconnect one client | Reconnecting feedback; reconnect and reload state |
| Opponent loses connection | After 15 seconds without heartbeat, show a 30-second grace countdown |
| Stay disconnected beyond detection + grace | Server resolves forfeit within the five-second scheduler cadence |
| Both disconnect beyond grace | Server records an abandoned draw |
| Timer expires | Server compares confirmed correct entries; equal progress draws |
| Explicit forfeit | Confirm once; opponent wins; terminal result stays immutable |
| Open a third authenticated session | Full room rejects a new participant |
| Repeat join | Existing member recovers their seat; no duplicate seat |
| Join nonexistent, expired or started room | Clear error; no unauthorized access |
| Double-click Start | At most one active match is created |
| Two moves with the same action UUID | Side effects occur once |
| Two requests using the same board version | One commits; the stale request is rejected and resynchronized |
| Finish nearly simultaneously | First verified completion under the server's room/match lock wins |
| Use another tab for the same account | Shared confirmed board, version conflicts resynchronize; both tabs keep the same seat |
| Log out during a race | Protected UI closes; without another active tab, heartbeat stops and disconnect grace applies |
| Guest requests another room's data | RLS and verified-member commands deny access |

Background mobile browsers can suspend networking. This is treated as a lost
connection when heartbeats stop; the clock still continues on the server.

## 6. Optional real two-browser automation

After manually verifying both accounts, you can provide their credentials through
temporary process environment variables and run:

```powershell
npm.cmd run test:multiplayer
```

Required variables: `SUDUEL_QA_EMAIL_A`, `SUDUEL_QA_PASSWORD_A`,
`SUDUEL_QA_EMAIL_B`, `SUDUEL_QA_PASSWORD_B`. Supply them using your own secret
handling; do not paste passwords into source. No default credentials exist.
The test skips with a clear reason when these values are absent. Its browser
contexts disable trace, screenshot and video recording of credential sessions.

This test logs two real users in, creates/joins/readies/starts a room, checks equal
clues and progress privacy, refreshes confirmed state, briefly disconnects and
recovers the mobile client, solves via real UI submissions, checks both results,
accepts a rematch, forfeits and checks saved history. It creates real matches and
updates these accounts' Classic Race statistics; use test accounts.

## Checks already performed

- Production build and strict TypeScript passed.
- 24 domain/unit tests passed.
- 14 browser tests passed, including Phase 1 regression and UI-only multiplayer
  fixtures at 390/768/1024/1440px. The real-account test was skipped.
- 30 database contract assertions passed in a rolled-back transaction with
  synthetic database-only identities. No fixture users remain.
- Live anonymous command/Edge Function calls returned 401; private schema access
  returned 406. Scheduled match-clock jobs returned `succeeded`.
- Security advisor: no application schema/RLS findings after hardening; one Auth
  warning remains for disabled leaked-password protection.
- Runtime dependency audit: zero vulnerabilities.

These results do **not** claim that email delivery, actual two-account Realtime
gameplay, real network races, or cross-device latency have been verified yet.
