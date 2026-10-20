# ADR 0024 — Focus flags for possible cheating

**Date:** 2026-10-20
**Status:** Proposed
**Deciders:** Vladimir Kirov

---

## Context

Players answer on their own phones, and the phone that shows the question can also look up the
answer. The host wants to know when a player leaves the game while a question is on.

What exists today:

| Piece          | Today                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| Player event   | `FOCUS_CHANGE { away }`, sent on `visibilitychange` (tab or app switch, locked screen).      |
| Host handling  | Sets `Player.presence` to `hidden` or `connected`; logs `player_hidden` / `player_back`.     |
| Log rate limit | 10 focus entries per player per minute, so a client switching back and forth can't flood it. |
| Host view      | A presence icon per player, and the raw entries in the game log.                             |

What's missing: a window that loses focus without being hidden (split screen, a popup, a
notification shade on some phones) isn't reported, and the host can't see at a glance which
team left how often, for how long, or during which question.

---

## Decision

### 1. The player reports focus loss as well as hidden pages

`useFocusReport` (`pages/player/focus-report.ts`) treats the game as out of sight when the page
is hidden or the window has lost focus, and sends `FOCUS_CHANGE` once per change. Focus that
moved into an embedded frame (a video widget) still counts as on the page; the check runs a tick
after `blur`, once the frame holds focus. The message is unchanged, so hosts and players of
different versions still understand each other.

### 2. Flags are read from the game log

`buildFocusLapses` (`lib/focus-flags.ts`) walks the game's log in time order:

- a lapse starts at `player_hidden` and ends at `player_back`, or when the player disconnects,
  leaves or is kicked (phones often drop a page left in the background);
- only lapses while the game runs count: after `game_started` or `game_resumed`, before
  `game_paused` or `game_ended`;
- each lapse takes the round and question number of the latest `question_shown`.

`buildFocusFlags` groups lapses by team (a player without a team stands alone), most first.
The **Focus flags** panel on the host's People tab lists them, with each lapse's time, player,
question and duration.

No new table, field or migration: the log already holds every entry with a timestamp, survives a
host reload and is exported with the game.

### 3. Flags only

Nothing is deducted and players aren't told. A locked phone, an incoming call or a phone set
down looks the same as a search, so the host decides.

---

## Consequences

- The host sees per-team counts, time away and the question for each lapse, live.
- Window blur adds entries the old version didn't send, such as pulling down a notification
  shade where the browser treats it as a blur. They show in the log as "Left the game screen".
- The log's rate limit caps a player at 10 lapses a minute. Real use stays well under it, and a
  client that hits it is flagged anyway.
- A modified client can stop sending `FOCUS_CHANGE`. Flags catch honest phones, not determined
  cheaters; nothing in a browser-only app can do more.

---

## Alternatives considered

| Option                                 | Why not                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Count lapses on `Player` or `Team`     | A schema change for data the log already has, and no question context.          |
| Send the question id in `FOCUS_CHANGE` | Trusts the client for what the host already knows; changes the message.         |
| Deduct points automatically            | False positives (locked screens, calls) would punish honest players.            |
| Track only `visibilitychange`          | Misses split screen and popups, which leave the question visible but unfocused. |
