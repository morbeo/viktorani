# ADR 0020 — Choosing a game's layouts

**Date:** 2026-10-15
**Status:** Accepted
**Deciders:** Vladimir Kirov

---

## Context

`resolveLayout` picks a surface's layout by rank: the game's own layouts over templates, an
exact phase over all phases, then the active one and the lowest order (ADR 0017). The host
had no way to say "this game uses that template on the screen when answers are revealed"
short of copying and reordering layouts (#415).

---

## Decision

- **Choices live on the game**, as `Game.layoutAssignments`: per surface, a layout id for
  each phase and for `all`. The field is optional, needs no index, and is kept in backups.
- **A choice wins.** `resolveLayout` takes the choice for the phase, then the choice for all
  phases, then ranks as before. A choice must be the game's own layout, a template or a
  built-in default for that surface, and must render; otherwise it is ignored.
- **Remote surfaces make the same choice.** `LAYOUT` gains `assignments`, the surface's
  choices. `layoutsForPhases` includes each chosen stored layout, so resolving among the
  sent layouts with the same choices gives the host's answer. Ids are bounded like every
  other id; when the event can't be built within its limits it carries no layouts and no
  choices.
- **Where the host chooses:** the Layouts section of the Game settings drawer (per surface
  and phase, with "Automatic" naming the layout used without a choice), and "Show layout on
  screen / phones" in the command palette, which sets the choice for the current phase.

---

## Consequences

- Picking a layout never changes the layouts themselves, so templates stay shared.
- A choice that points to a deleted layout is ignored rather than cleaned up.
- The scoreboard surface isn't offered until it renders through layouts.
