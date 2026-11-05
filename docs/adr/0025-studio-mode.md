# ADR 0025 — Studio mode: preview the next layout, then cut or take

**Date:** 2026-11-02
**Status:** Accepted (2026-11-05)
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

---

## Addendum (2026-11-05): more transitions and a speed

- **Four more transitions.** `transition` is now one of `cut`, `fade`, `dip` (the new
  layout comes up from black under a cover that clears), `slide` (pushes in from the
  right), `zoom` (grows from 85% while fading in) and `wipe` (revealed from the right edge,
  with `clip-path`). Slide and wipe have one fixed direction; a direction could be added
  later as another optional field.
- **A speed.** `PHASE` gains an optional `speed: 'short' | 'normal' | 'slow'` (0.3 s, 0.6 s,
  1.2 s), sent only when it isn't `normal`, so a normal fade is still byte-for-byte what it
  was. The screen sets `--studio-duration`, which every transition's animation reads.
- **Cut, plus Take with a picker.** The panel keeps **Cut** as one tap and adds a
  **Transition** and **Speed** picker beside **Take**. The pick is kept in the studio state
  (`pick`), defaulting to a normal fade, so it survives reloads with studio mode.
- **Unknown values cut.** The schema now turns a `transition` or `speed` it doesn't know
  into `cut` or `normal` instead of rejecting the event, so a screen on this build or later
  keeps up with a host that adds more. Screens built before this addendum still reject the
  new values, and keep their last layout until the next cut, as before.
- **Still a fade-in, not a mix.** Every transition animates only the incoming layout; the
  old one is gone at the take, as with the fade. A true dip out and back in would need the
  old layout held on screen for half the transition.
