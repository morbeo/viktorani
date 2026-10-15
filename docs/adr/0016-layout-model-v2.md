# ADR 0016 — Layout model v2: grid, phases and themes

**Date:** 2026-10-15
**Status:** Accepted
**Deciders:** Vladimir Kirov

---

## Context

The screen layout designer (epic #364) needs a data model that can describe every game
surface. The declared but unused v1 model had a `Layout.target` of `'admin' | 'player'`
and placed widgets with `width: 'full' | 'half'` in a single flow, which can't express
side-by-side widgets of different sizes, a different arrangement on phones and TVs, a
per-surface look, or a different layout per game phase. Issue #409 defines v2.

---

## Decision

- **Targets:** `Layout.target` is a `LayoutTarget`: `gamemaster`, `player`, `screen` or
  `scoreboard`. The widget registry's `WidgetTarget` is the same type, so a widget's
  allowed targets and a layout's target can't drift apart.
- **Grid:** every layout uses a 12-column grid. A widget has a base `grid` rect
  (`x`, `y`, `w`, `h` in cells) and optional `breakpoints.phone` / `breakpoints.tv`
  overrides that fall back to the base. The column count is the same on every device;
  only placement changes. Row height is the renderer's choice (#410). `order` stays as
  the reading and keyboard order.
- **Phases:** `Layout.phase` is a `GamePhase` (`lobby`, `question`, `buzzed`, `reveal`,
  `scoreboard`, `ended`) or `null` for a layout that covers every phase without its own.
  Choosing the layout for the current phase and the GM override are #414's job.
- **Theme:** `Layout.theme` holds `background` and `accent` (`#rrggbb`), `fontScale` and
  `logo` (`data:image/` or `https://`). Each `null` inherits the app theme.
- **Migration:** Dexie v16 maps `'admin'` layouts to `'gamemaster'`, adds `phase: null`
  and the default theme, and packs each layout's widgets into one-row-tall rows in
  `order` (a half widget spans 6 columns, a full one 12), which matches how the old flow
  showed them.
- **Backups:** layouts and widgets are designed by the host, not produced by play, so the
  JSON snapshot includes them. It stays at version 2, because older files without them just
  restore no layouts. Import validates grid rects, colours and logo URLs, and rejects
  widgets whose layout isn't in the file.

---

## Consequences

- Layouts behave the same everywhere: the renderer, the `LAYOUT` transport event (#411)
  and the designer (#412) all work on `GridRect`s, with the pure helpers in
  `lib/layout-grid.ts`.
- A 12-column grid on a phone is coarse but simple; phone layouts will mostly use full
  width overrides.
- Widget `config` is still an opaque object in storage and backups. Per-type validation
  against the registry's schemas happens where configs are used (#410, #411), not in
  the db layer, which must not import UI code.
- Cloning a game doesn't copy its layouts yet; that comes with per-game layout
  assignment (#415).
