# ADR 0025 — Studio mode: preview the next layout, then cut or fade

**Date:** 2026-11-02
**Status:** Proposed
**Deciders:** Vladimir Kirov

---

## Context

Each surface shows the layout for the game's phase (ADR 0019), so the projector changes the
moment a player buzzes, the host rules or holds the scoreboard. A host running the room like a
broadcast wants to see the next layout first and choose when it goes up, the way a vision
mixer has a preview and a program. Studio mode was planned with the first screen management
work and deferred until layouts and phases existed.

---

## Decision

- **The screens get their own phase.** The projector window, remote screens, spectators and
  scoreboard devices show the _program_: in studio mode, the phase the GM last took
  (`programPhase`); otherwise the game's phase, as before. The game master's play column and
  the players' phones always follow the game: players need the question to answer it.
- **Studio state lives in local storage**, per game (`viktorani:studio:<gameId>`), like the
  phase override, so the projector window on the host machine follows takes without a
  transport connection. The stored value is the program phase and how it was taken; its
  absence means studio mode is off. No Dexie change.
- **Turning studio mode on keeps what is on screen** (the program starts at the current
  phase). Turning it off cuts the screens back to the game's phase.
- **The lobby and the end bypass studio mode**, as they bypass the override: starting or
  ending the game is a take of its own, and a program left at either falls back to the game.
- **A take is Cut or Fade**, from the play column or the command palette, offered only when
  the next phase differs from the one on air. A take sets the program to the game's current
  phase (after the override).
- **`PHASE` gains an optional `transition: 'cut' | 'fade'`.** The host sends screens their
  program phase whenever it changes, and adds `transition: 'fade'` only for a fade take, so
  every other `PHASE` is byte-for-byte what it was. A screen fades the new layout in over
  0.6 s (`animate-fade-in`, skipped under reduced motion); anything else cuts.
- **Only the layout is held.** Question content, scores, timers and the log inside the
  layout stay live. Holding the content too would mean buffering every screen event.
- **The preview is a sketch.** The two monitors render the screen layout for each phase with
  the designer's sample data, scaled to a fifth, and name the phase and layout. The real
  content is on the GM's own question panel.

---

## Consequences

- With studio mode off, nothing changes on any surface or on the wire.
- A screen built before this change rejects a `PHASE` carrying `transition` (the schema is
  strict) and keeps its last layout until the next cut; cuts and joins still reach it.
- Scoreboard between rounds (ADR 0019) holds the scoreboard on phones and the GM column at
  once, but the screens only show it when the GM takes it.
- Like the override, studio mode doesn't follow the GM to another machine.

---

## Alternatives considered

| Option                                      | Why not                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| Hold phones too                             | Players would miss questions and buzz windows until the GM takes them.      |
| Hold question content as well as the layout | Needs a buffer for every screen event; the layout is what changes the look. |
| A `Game` field for studio mode              | A Dexie version for an operator preference the override already models.     |
| A new `TRANSITION` event before `PHASE`     | Two events per take that can arrive split; an optional field is simpler.    |
| Crossfade the old and new layouts           | Two live layouts on a TV at once; a fade-in reads the same and costs less.  |
