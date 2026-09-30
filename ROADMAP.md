# Roadmap

Maintained by the `pm` agent (`.claude/agents/pm.md`). Items are in priority order within each phase. Link issues/PRs as `(#123)` and tick items when merged.

## Phase 1: Host stability (GameMaster works end-to-end)

- [ ] Buzzer lock state never reaches React state; the buzzer gets stuck (`useBuzzer.ts:80-99`, `GameMaster.tsx:440`)
- [ ] Awarding points throws: `gameQuestions.where('questionId')` isn't indexed (`useBuzzer.ts:145`)
- [ ] Timer auto-reset is overwritten by stale `pauseTimer` writes (`GameMaster.tsx:329-334`)
- [ ] Round order comes from `db.rounds.toArray()` instead of `game.roundIds` (`useNavigation.ts:42-50`)
- [ ] Scoreboard goes stale after adjudication; team adjustments are wiped by player recompute (`useScoreboard.ts`)
- [ ] Correct can be awarded twice on double-click; no transaction (`useBuzzer.ts:125-155`)
- [ ] Buzz history is deleted on question change, never reloaded, and `clearBuzzes` isn't scoped to the game
- [ ] `window.__vkt_handleBuzz` is never cleared on unmount
- [ ] Game create/clone/delete: use transactions, delete timers, reset status on clone, block zero-question games
- [ ] Fix the `GameQuestion.order` doc comment (order is global across rounds)

## Phase 2: CI, release & security hygiene

- [ ] `ci.yml:35` PR title script injection; changelog injection in `release.yml`
- [ ] `release.yml:92` missing `\`: releases failing since v0.0.9
- [ ] Make CI a required status check
- [ ] `detect-code-changes.sh` paths don't match the deploy paths; deploy repeats CI's work
- [ ] Validate imported JSON with zod in a single transaction (`db/snapshot.ts`)
- [ ] Add `.max()` limits to transport schemas; add a CSP
- [ ] Dexie version was reset from 4 to 1 after deploys started: decide on a migration strategy (versions must only increase)
- [ ] Hygiene: `scripts/` in `.gitignore`, unused `@playwright/cli`, README claims about Gun/Reveal.js, note-import regex

## Phase 3: Player side (MVP)

Blocked on decisions (see below).

- [ ] Join flow (`Join.tsx` is a stub): room code/QR → name → team
- [ ] Play screen connects and sends JOIN / BUZZ / LEAVE / FOCUS_CHANGE
- [ ] Host sends question content per visibility settings
- [ ] Host validates the player identity instead of trusting self-claimed `playerId`
- [ ] Buzz ordering by host receive time (`tiebreakerMode: 'serverOrder'`)
- [ ] Projector/screen route (Layouts)
- [ ] Align or trim the e2e specs with the real UI

## Decisions needed

- Where do questions appear: player phones, projector, or both?
- Include the passphrase in the join QR code?
- Player identity model (device id vs. host-issued token)
- Keep the Gun transport (currently broken: globals never loaded) or drop it?
- Late join / rejoin policy
