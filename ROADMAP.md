# Roadmap

Maintained by the `pm` agent (`.claude/agents/pm.md`). Items are in priority order within each phase. Link issues/PRs as `(#123)` and tick items when merged.

## Phase 1: Host stability (GameMaster works end-to-end)

Epic: #242

- [ ] Buzzer lock state never reaches React state; the buzzer gets stuck (`useBuzzer.ts:80-99`, `GameMaster.tsx:440`) (#245)
- [ ] Awarding points throws: `gameQuestions.where('questionId')` isn't indexed (`useBuzzer.ts:145`) (#246)
- [ ] Timer auto-reset is overwritten by stale `pauseTimer` writes (`GameMaster.tsx:329-334`) (#248)
- [ ] Round order comes from `db.rounds.toArray()` instead of `game.roundIds` (`useNavigation.ts:42-50`) (#249)
- [ ] Scoreboard goes stale after adjudication; team adjustments are wiped by player recompute (`useScoreboard.ts`) (#250)
- [ ] Correct can be awarded twice on double-click; no transaction (`useBuzzer.ts:125-155`) (#247)
- [ ] Buzz history is deleted on question change, never reloaded, and `clearBuzzes` isn't scoped to the game (#251)
- [ ] `window.__vkt_handleBuzz` is never cleared on unmount (#252)
- [ ] Game create/clone/delete: use transactions, delete timers, reset status on clone, block zero-question games (#253)
- [ ] Fix the `GameQuestion.order` doc comment (order is global across rounds) (#254)

## Phase 2: CI, release & security hygiene

Epic: #243

- [ ] `ci.yml:35` PR title script injection; changelog injection in `release.yml` (#255)
- [ ] `release.yml:92` missing `\`: releases failing since v0.0.9 (#256)
- [ ] Make CI a required status check (#257)
- [ ] `detect-code-changes.sh` paths don't match the deploy paths; deploy repeats CI's work (#258)
- [ ] Validate imported JSON with zod in a single transaction (`db/snapshot.ts`) (#259)
- [ ] Add `.max()` limits to transport schemas (#260); add a CSP (#261)
- [ ] Dexie version was reset from 4 to 1 after deploys started: decide on a migration strategy (versions must only increase) (#262)
- [ ] Hygiene: `scripts/` in `.gitignore`, unused `@playwright/cli`, README claims about Gun/Reveal.js, note-import regex (#263)

## Phase 3: Player side (MVP)

Epic: #244

- [ ] Remove the Gun transport: `GunTransport`, passphrase, `auto` mode, Gun settings/UI, README section
- [ ] Join flow (`Join.tsx` is a stub): room code/QR → name → team
- [ ] Play screen connects and sends JOIN / BUZZ / LEAVE / FOCUS_CHANGE
- [ ] Host binds players to their PeerJS connection instead of trusting self-claimed `playerId`
- [ ] Late join / rejoin / host approval: three independent game settings
- [ ] Per-target visibility (projector vs. phones) for question / answers / media; host sends content accordingly
- [ ] Buzz ordering by host receive time (`tiebreakerMode: 'serverOrder'`)
- [ ] Projector/screen route (Layouts)
- [ ] Align or trim the e2e specs with the real UI

## Decisions (2026-09-30)

Full text in #244.

- **Gun transport:** dropped; PeerJS only.
- **QR contents:** room code only (no passphrase without Gun).
- **Question display:** the game master sets visibility per target (projector, phones).
- **Player identity:** bound to the PeerJS connection; the device id only matches rejoins.
- **Late join / rejoin:** separate host toggles for late join, rejoin, and host approval.
