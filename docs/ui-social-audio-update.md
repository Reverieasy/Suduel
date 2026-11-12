# UI, music, presence and opponent chat

The homepage practice link says “Warm up with solo practice.” Its eyebrow now
shows connected players through Supabase Presence, including visitors on other
routes or in games. Tabs sharing the browser's visitor key count once. Separate
browsers/devices count separately; this is a connection count, not a count of
unique authenticated accounts. No names or account details enter the channel.
Unavailable connections show an explicit unavailable state instead of a fake count.

Background music is mounted once at the application root and continues across
SPA navigation, including practice and competitive games. Browsers require an
initial interaction. Master volume, mute and the Background music toggle apply
globally and persist. Hidden tabs pause the music and resume when visible.

Fog now displays only “Fog,” over animated smoke layers. Freeze adds crystalline
board ice and a screen-edge effect for the affected player. These layers do not
move layout or intercept controls. Reduced motion keeps the overlays static.
Full-board concealment, server validation and saved-rule compatibility remain.

Leaderboard rows use the many-to-one profile object returned by PostgREST,
display account handles and link to `/players/:username`. Missing profiles are
distinct from query errors, and obsolete asynchronous profile responses are ignored.

Opponent chat opens as a fixed popover in Battle and Classic, including ranked
Battle rooms. Current room members can read the last 50 messages and receive
authorized Realtime updates, with a three-second polling fallback even when closed.
New opponent messages show a red unread dot and a five-second message preview
only while chat is closed. Opening chat clears both; dismissing or timing out
the preview keeps the unread dot. Historical messages, own-message echoes and
duplicate deliveries do not notify. Arrival leaves board layout and focus intact.
The database chooses sender identity and timestamp. Only verified players can
send through the RPC. Clients cannot insert, edit, delete or forge messages.
Messages are limited to 300 characters and three new messages per five seconds
per sender across rooms. Identical retries use one server-confirmed message.
Messages render as plain text. The server retains history for reconnection.

Verification on November 12, 2026:

- TypeScript application/test checks, ESLint and production build passed.
- 54 unit tests passed; 45 browser tests passed; two real-account tests skipped
  because their runtime credentials were not provided.
- The rolled-back `room_chat_contract.sql` passed: current member history,
  outsider/former-member denial, sender identity, direct-write denial, anonymous
  denial, whitespace/length checks, rate limits and idempotent retries.
- Supabase health advisors passed; security advisors added no new findings.
- Two independent browser contexts connected to the real Presence service.
  A second tab stayed deduplicated, practice navigation retained presence, and
  leaving removed the second connection. No test accounts or messages were used.
- Browser fixtures covered object-shaped leaderboard joins and both player links,
  plaintext chat, sending/retrying, incoming history, keyboard behavior, stable
  board position, phone width, music persistence, and smoke/ice reduced motion.

These checks do not replace the pending two-real-authenticated-player acceptance.
Use `scripts/test-live.ps1` for the existing match acceptance test, without putting
credentials in chat or committed files. In two verified sessions, also open a
Classic or Battle room, open chat in each, exchange messages, refresh one browser
and confirm its history returns. In Battle, cast Fog/Freeze and check that the
victim's effects expire without moving either board. Check that background music
continues between pages and can be muted from Sound settings.

The subsequent unread-notification update passed the production build, ESLint,
application/test TypeScript checks, and 18 focused browser tests for chat and
Battle regression. Notification cases ran at 390px and 1440px, covering initial
history, own echoes, duplicate polls, preview expiry/dismissal, unread clearing,
click-to-open, open-chat suppression and stable board focus/position.
