# Roadmap

Maintained by the `pm` agent (`.claude/agents/pm.md`). Items are in priority order within each phase. Link issues/PRs as `(#123)` and tick items when merged.

## Phase 1: Host stability (GameMaster works end-to-end)

Epic: #242

- [x] Buzzer lock state never reaches React state; the buzzer gets stuck (`useBuzzer.ts:80-99`, `GameMaster.tsx:440`) (#245)
- [x] Awarding points throws: `gameQuestions.where('questionId')` isn't indexed (`useBuzzer.ts:145`) (#246)
- [x] Timer auto-reset is overwritten by stale `pauseTimer` writes (`GameMaster.tsx:329-334`) (#248)
- [x] Round order comes from `db.rounds.toArray()` instead of `game.roundIds` (`useNavigation.ts:42-50`) (#249)
- [x] Scoreboard goes stale after adjudication; team adjustments are wiped by player recompute (`useScoreboard.ts`) (#250)
- [x] Correct can be awarded twice on double-click; no transaction (`useBuzzer.ts:125-155`) (#247)
- [x] Buzz history is deleted on question change, never reloaded, and `clearBuzzes` isn't scoped to the game (#251)
- [x] `window.__vkt_handleBuzz` is never cleared on unmount (#252)
- [x] Game create/clone/delete: use transactions, delete timers, reset status on clone, block zero-question games (#253)
- [x] Fix the `GameQuestion.order` doc comment (order is global across rounds) (#254)

## Phase 2: CI, release & security hygiene

Epic: #243

- [x] `ci.yml:35` PR title script injection; changelog injection in `release.yml` (#255)
- [x] `release.yml:92` missing `\`: releases failing since v0.0.9 (#256)
- [x] Make CI a required status check (#257)
- [x] `detect-code-changes.sh` paths don't match the deploy paths; deploy repeats CI's work (#258)
- [x] Validate imported JSON with zod in a single transaction (`db/snapshot.ts`) (#259)
- [x] Add `.max()` limits to transport schemas (#260); add a CSP (#261)
- [x] Dexie version was reset from 4 to 1 after deploys started: decide on a migration strategy (versions must only increase) (#262)
- [x] Hygiene: `scripts/` in `.gitignore`, unused `@playwright/cli`, README claims about Gun/Reveal.js, note-import regex (#263)

## Phase 3: Player side (MVP)

Epic: #244

- [x] Remove the Gun transport, passphrase and auto mode (#265)
- [x] Protocol: join handshake, lobby info, question content, targeted visibility (#266)
- [x] Join policy settings: late join, rejoin, approval, player-created teams (#267)
- [x] Per-target visibility for screen and phones (#268)
- [x] Bind players to their PeerJS connection (#269)
- [x] Join flow (#270)
- [x] Play screen: connect, buzz, leave, focus (#271)
- [x] Enforce late join / rejoin / approval (#272)
- [x] Broadcast question content per target (#273)
- [x] Question content on phones (#274)
- [x] Buzz ordering by host receive time (#275)
- [x] Host-side projector window (#276)
- [x] Networked screen peer (#277)
- [x] Align e2e specs with the real player flow (#278)

## Phase 4: Post-MVP hardening and cleanup

Epic: #332

- [x] Reopening an ended game re-admits players and buzzes (#333)
- [x] Import-from-managed reuses global ids and lacks a transaction (#334)
- [x] Surface transport errors and reconnect (#335)
- [x] Host peer leaks if unmounted mid-connect (#336)
- [x] Players and screens ignore `GAME_STATUS` (#337)
- [x] `TIMER_EXPIRED` ignores notify settings (#338)
- [x] Late joiners and screens don't get running timers (#339)
- [x] Snapshot omits `gameQuestions` (#340)
- [x] `GameQuestion.status` is never written (#341)
- [x] `BuzzEvent.teamId` is always null (#342)
- [x] Remove dead code found in review (#343)
- [x] Split `GameMaster` and fix `RemoteScreen` cross-page import (#344)
- [x] A connection closed while queued can still be admitted (#345)
- [x] Fix drift in `host.md`, `player.md`, README, and the BUZZ comment (#346)

## Phase 5: UI/UX feedback round

Epic: #363

- [x] Live-game indicator next to Games in the sidebar (#361)
- [x] Debug info moved into the left sidebar (#360)
- [x] Player status indicators with a clear meaning (#356)
- [x] Contextual help tooltips, shared `Tooltip` component (#355)
- [x] Command palette, Ctrl/⌘+K (#357)
- [x] Compact, grouped game settings with presets (#358)
- [x] Settings reorganized into categories, plus new settings (#359)
- [x] Game master grouped by meaning, with icon + short-label buttons (#362)

## Phase 6: Gamemaster roster, notes, log and game settings

No tracking epic; standalone issues/PRs in the gamemaster area.

- [x] `LOG` transport event for screens and scoreboards (#407, #416)
- [x] Game log panel: search, filter, sort (#406)
- [x] List and disconnect approved screens (#419, #425)
- [x] Make the buzzer optional per game (#420, #426)
- [x] Add player, bulk actions and team assignment from the roster (#422, #427)
- [x] Rename teams, add team notes, and click-to-select members (#423, #429)
- [x] Add player notes per game (#431)
- [x] Group the roster by team, log messages, and rework the log's kind filter (#433)
- [x] Cap total players per game, part of #424's scope (#432)
- [x] Rejoin window, confirm navigating away from an unruled question, auto-start timer, and timer sound mute, part of #424's scope (#434)
- [x] Warn the host when a join's device doesn't match an existing player with that name (#435)
- [x] Auto-advance after a correct ruling or when the question timer runs out, part of #424's scope
- [x] Remove players who stay disconnected past a timeout, part of #424's scope
- [ ] Expand game settings further: tiebreaker modes, local-network-only join, auto-reveal the correct answer, spectator join (#424, remaining scope — the player cap shipped in #432, confirm-navigation in #434, and "floor scores at zero" already holds)
- [x] Per-question/round/game timers: shortcut presets in the new-timer dialog, and the auto-started question timer is reused instead of stacked (#421)

## Phase 7: Screen layout designer (in progress)

Epic: #364. Scope and dependency order are in the epic body: widget registry → layout model v2 → `LayoutRenderer` → `LAYOUT` transport event → designer UI (canvas, then templates/polish) → phase-based switching → per-game assignment. #374 (game log widget) and #377 (host message panel) are related but separate issues, both already merged.

- [x] Widget registry and extract current views into widgets (#408) — registry built in #417; QR, `round_info`, `announcement`, and screen-side `question`/`answers`/`media` extracted in #417/#418. The `progress` widget followed once the designer existed: the track is now its own `ProgressTrack`, shared by `NavHeader` and the game master's widget.
- [x] Layout model v2 — responsive grid, phases, Dexie migration (#409) — #439
- [x] `LayoutRenderer` and default layouts for all surfaces (#410) — the projector screen in #440, the game master's play column and the player view in this change. The scoreboard surface keeps its fixed view until it gets a page of its own.
- [x] `LAYOUT` transport event, validation, resend on admit/phase change (#411). Each phase's layout is sent up front, so a phase change needs no resend (ADR 0018).
- [x] Designer: canvas, palette, drag/resize, inspector (#412) — `/admin/layouts` (templates) and `/admin/layouts/:gameId`
- [x] Designer: templates, undo/redo, device previews, keyboard editing (#413)
- [x] Phase-based automatic layout switching and the GM override (#414) — ADR 0019
- [x] Assign layouts per surface and phase in game settings (#415) — ADR 0020

## Decisions (2026-10-19)

- **Scoped timers (#421):** shortcut presets rather than fully automatic timers. The new-timer dialog offers This question, This round and Whole game, which set the label (Question, Round, Game) and the auto-reset (`question`, `round`, `none`). The game's auto-started timer is a question timer reused from question to question, and replaced only when the default duration changed.
- **Auto-advance (#424):** after a correct ruling, or when a question timer (auto-reset `question`) runs out, the game moves to the next question after a countdown the host can cancel (5 s by default, 1 to 60). Navigating by hand, pausing or the last question drops it, and a timer that ran out before the page opened doesn't count. "Auto-reveal the correct answer" is left out: players are never sent the correct answer today, so revealing it needs a transport change of its own.
- **Auto-remove (#424):** `autoRemoveAfterMinutes` (0 = never, up to 99) marks a player who stays disconnected that long as left, checked every 5 s on the host. Players who left, by Leave or this timeout, no longer count toward `maxPlayers`, and can still rejoin as themselves when rejoining is allowed, as long as a place is free (the security review on #475 caught a cap bypass otherwise).
- **Next up:** #424's remaining settings, one PR each.

## Decisions (2026-10-16)

- **Game master widgets (#364):** `buzz_order` is the buzz queue with its judging buttons but no lock or clear; `player_list` is read-only and leaves out players who left or were kicked; `game_controls` has previous, next and the buzzer lock (pause and end stay in the toolbar). Like the buzzer, they hide once the game ends, and they don't preview in the designer.
- **Text and image widgets (#364):** the first widgets with settings, offered on every surface. Text is plain text (no markdown or HTML) up to 1,000 characters; an image address follows the logo's rule (`data:image/` or `https://`), capped at 400,000 characters so several phase layouts still fit in one `LAYOUT`, and inlined images are dropped before the whole event is. Text settings save on blur, one undo step per edit, and each setting merges into the stored config.
- **Leaderboard widget (#364):** the screen's top places, large and numbered, with a title and 1 to 10 places (three by default). Equal scores share a place, and a tie at the cut-off is shown whole. The scoreboard surface keeps the placeholder until it has a page.
- **Next up:** every placeholder widget except the scoreboard surface's is now real; that surface needs a page of its own first.

## Decisions (2026-10-15)

- **Phase 6 status:** #432, #433, #434 and #435 are merged. Only #424's remaining settings and the #421 timer design question are left in this phase.
- **Layouts on the game master and player (#410):** only the game master's play column renders through its layout; the controls, navigation and side panel stay fixed around it. On the player, the name, score and connection or pause notices stay fixed. Both use the built-in default until #411/#415 deliver stored layouts.
- **Designer scope (#412):** live preview covers the player and projector screen only; the game master and scoreboard show a notice until they render from sample data. Keyboard editing on the canvas and undo/redo stay in #413 (the inspector's placement fields already work without a pointer). Config forms are generated from each widget's Zod schema; every schema is empty today, so the form shows "no settings".
- **Designer polish (#413):** undo/redo snapshots the whole layout before each change and keeps 50 steps per layout, cleared when another layout is chosen; deleting a whole layout isn't undoable (it asks first). Templates are plain layouts with no game: new layouts start empty, from a built-in default or a template, and any layout can be duplicated, saved as a template or copied into a game. Device previews were already in #412.
- **Phase switching (#414):** the phase follows the buzzes (`question`, `buzzed`, `reveal`); `scoreboard` only comes from the GM's override, which is kept per game in local storage so the projector window on the host machine follows it. The GM's play column and that window now read stored layouts too.
- **Layout choices (#415):** a game's choices are stored on the game (`layoutAssignments`, per surface and phase or all phases) and win over the automatic pick; `LAYOUT` carries them so remote surfaces choose the same. The scoreboard surface has no page yet, so it isn't offered.
- **Progress widget (#408):** only the game master offers it, since players and screens get no navigation data; `leaderboard`, `text`, `image`, `buzz_order`, `player_list` and `game_controls` remain placeholders, each needing data or config of its own.
- **Next up:** every item under #364 is done; the remaining placeholder widgets need issues of their own.

## Decisions (2026-10-05)

- **Widget registry scope (#408):** registry components are placeholders until `LayoutRenderer` (#410) wires in live game state; only a proof-of-concept extraction (QR panel) shipped in #417, with the rest following in #418. The `progress` widget is deliberately deferred — splitting it out of `NavHeader` isn't worth the risk before the designer (#412) exists to use it.
- **"Floor scores at zero" (part of #424):** already true — `applyScoreDelta`/`toScore` unconditionally clamp at 0 — so #432 shipped the player cap only and left this unticked item in #424 as already satisfied.
- **Next up:** #433 and #432 are both green on CI and waiting on the security agent's review before Vladimir merges them. After that, the logical next pickup is #409 (layout model v2), the next item in #364's stated dependency order — not the deferred `progress` widget gap in #408.

## Decisions (2026-09-30)

Full text in #244 (team score in #250).

- **Gun transport:** dropped; PeerJS only.
- **QR contents:** room code only (no passphrase without Gun).
- **Question display:** the game master sets visibility per target (projector, phones).
- **Player identity:** bound to the PeerJS connection; the device id only matches rejoins.
- **Late join / rejoin:** separate host toggles for late join, rejoin, and host approval.
- **Projector:** both a host-side window and a networked screen peer (host-approved).
- **Team creation:** mutable game setting; players pick or also create teams.
- **Team score:** stored on its own. A correct answer by a team member adds the points to both the player and the team; manual adjustments change only the row they target.
- **Round builder in the new-game wizard:** post-MVP; the placeholder stays until then.

## Post-MVP

- [x] Inline round builder in the new-game wizard (#288)
