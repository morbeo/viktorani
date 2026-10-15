# ADR 0019 — Switching layouts by game phase

**Date:** 2026-10-15
**Status:** Accepted
**Deciders:** Vladimir Kirov

---

## Context

Layouts can be made for one game phase (`lobby`, `question`, `buzzed`, `reveal`,
`scoreboard`, `ended`), and remote surfaces already hold each phase's pick (ADR 0018). But
every surface only knew "ended or not", so phase layouts other than `ended` never showed.
The game master also needs to show a phase by hand, such as the scoreboard between rounds
(#414).

---

## Decision

- **The phase comes from the game's state** (`autoPhase`): `lobby` before the start, `ended`
  after the end. While the game runs, a correct ruling on the question shown is `reveal`, a
  buzz waiting for a ruling (not a false start) is `buzzed`, and anything else is
  `question`. `scoreboard` has no trigger of its own.
- **The GM can hold a phase by hand** from the play column or the command palette, and set
  it back to automatic. The override only applies while the game runs (`effectivePhase`):
  the lobby and the end always show their own phase.
- **The override lives in local storage**, per game. The projector window on the host
  machine reads the database and the same key, so it follows the override without a
  transport connection. A `storage` event updates the other window at once.
- **The host sends a `PHASE` event** to admitted players and approved screens whenever the
  phase changes, and to each one when it is admitted or approved. Its only field is an enum
  value. A surface that has the game as ended uses `ended`, even if the last `PHASE` was
  lost as the host disconnected.
- **The game master's play column and the local projector window now read stored layouts**,
  like the remote surfaces, so a phase layout shows everywhere.

---

## Consequences

- No new layout data travels when the phase changes: one small event per change.
- `scoreboard` layouts only show when the GM chooses them. A trigger can be added later
  without changing the event.
- The override doesn't follow the GM to another machine; a fresh host window on the same
  machine keeps it.
