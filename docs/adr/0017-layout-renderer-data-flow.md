# ADR 0017 — How the layout renderer feeds widgets

**Date:** 2026-10-15
**Status:** Accepted
**Deciders:** Vladimir Kirov

---

## Context

`LayoutRenderer` (#410) turns a layout (ADR 0016) into a page. The widget registry left open
how live game state reaches each widget: most widgets need data that isn't in their stored
`config` (the current question, scores, timers), and the same widget type can show on
surfaces that get that data in different ways.

---

## Decision

- **One data object per surface.** Each target has a typed data contract (`SurfaceData`
  in `widgets/types.ts`); the surface builds it and the renderer hands it to every
  widget as `{ data, config }`. Registry components for a target are small adapters
  from that contract to the existing presentational components.
- **Slots where sources differ.** When two pages of the same surface get a piece from
  different places (the host's projector window reads timers from the database, a remote
  screen from the transport), the contract carries it already rendered (`timers`).
- **Validate, then fall back.** `resolveLayout` picks the best stored layout for the
  target, game and phase, skipping any that fail the stored-data schemas, put a widget
  on a target it isn't allowed on, or have a config its type rejects. With nothing left
  it uses a built-in default. The renderer also skips such widgets on its own.
- **Empty widgets collapse.** Cells whose widget renders nothing are hidden and rows have
  no gap of their own, so spacing lives in each surface's cell classes. That keeps the
  screen pixel-identical to the fixed view it replaced.
- **Surface by surface.** The projector screen renders through layouts first, because all
  its widgets already exist. The game master's play column and the player's phone view
  followed, each with a built-in default that reproduces its fixed view. What sits
  around them stays fixed: the game master's controls, navigation and side panel, and the
  player's name, score, Leave button and connection or pause notices.
- **Widgets guard what the phase forbids.** Each surface has an `ended` default without
  the buzzer and timers, but the adapters also hide those once the game has ended, so a
  stored all-phase layout can't bring them back.

---

## Consequences

- Adding a widget to a surface means extending that surface's data contract, not
  threading new props through the page.
- Remote screens and players get the host's stored layouts in the `LAYOUT` transport event
  (#411, ADR 0018); the host's projector window and play column will follow layout
  assignment (#415). The scoreboard surface has no renderer yet.
- Grid placement and theme overrides depend on stored numbers, so the renderer sets them
  as inline styles.
