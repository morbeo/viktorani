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
- [ ] Group the roster by team, log messages, and rework the log's kind filter (#433, PR open — CI green, awaiting security review and merge)
- [ ] Cap total players per game, part of #424's scope (#432, PR open — CI green, awaiting security review and merge)
- [ ] Expand game settings further: tiebreaker modes, auto-kick on disconnect, local-network-only join, auto-advance on correct/timer-expiry, confirm navigating away from an unruled question (#424, remaining scope — "floor scores at zero" already holds, see #432)
- [ ] Per-question/round/game timers — needs a design decision first: shortcut buttons vs. fully automatic timers (#421)

## Phase 7: Screen layout designer (in progress)

Epic: #364. Scope and dependency order are in the epic body: widget registry → layout model v2 → `LayoutRenderer` → `LAYOUT` transport event → designer UI (canvas, then templates/polish) → phase-based switching → per-game assignment. #374 (game log widget) and #377 (host message panel) are related but separate issues, both already merged.

- [x] Widget registry and extract current views into widgets (#408) — registry built in #417; QR, `round_info`, `announcement`, and screen-side `question`/`answers`/`media` extracted in #417/#418. Only the `progress` widget stays a placeholder (its pills are fused with `NavHeader`'s keyboard navigation); #408 is left open to track that, deferred until the designer actually needs a standalone widget.
- [ ] Layout model v2 — responsive grid, phases, Dexie migration (#409)
- [ ] `LayoutRenderer` and default layouts for all surfaces (#410)
- [ ] `LAYOUT` transport event, validation, resend on admit/phase change — flagged needs-security-review (#411)
- [ ] Designer: canvas, palette, drag/resize, inspector (#412)
- [ ] Designer: templates, undo/redo, device previews, keyboard editing (#413)
- [ ] Phase-based automatic layout switching and the GM override (#414)
- [ ] Assign layouts per surface and phase in game settings (#415)

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
