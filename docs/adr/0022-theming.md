# ADR 0022 — Theming: colours, fonts, icons and logos

**Date:** 2026-10-16
**Status:** Proposed
**Deciders:** Vladimir Kirov

---

## Context

Hosts run trivia nights for different venues and events and want the app to look like them:
their colours, their fonts, their logo on the projector and the players' phones. Today the
look is fixed, with a few partial hooks:

| Piece         | What exists                                                                                                                                                                                            | Gap                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colours       | CSS variables in `src/index.css`, a light and a dark palette, and a `system`/`light`/`dark` app setting. Semantic aliases (`--color-accent`, `--color-positive`, …) exist but few components use them. | Components mostly use the palette names (`--color-gold`, `--color-cream`, `--color-ink`), usually through inline `style`, and about 15 files have raw hex. Overriding `--color-accent` changes almost nothing. |
| Fonts         | Playfair Display, Lora and DM Mono from a Google Fonts `@import`.                                                                                                                                      | Not precached, so offline the app silently falls back to Georgia. Needs `fonts.googleapis.com` and `fonts.gstatic.com` in the CSP. Not configurable.                                                           |
| Icons         | Lucide through `components/ui/Icon`, `currentColor`, stroke 1.75.                                                                                                                                      | Fine as is; stroke and size are hard-coded.                                                                                                                                                                    |
| Logos         | None in the app shell. PWA icons are static files in `public/`.                                                                                                                                        | No place for a host's logo outside layouts.                                                                                                                                                                    |
| Layout themes | `Layout.theme` (ADR 0016): `background`, `accent`, `fontScale`, `logo`, each `null` = inherit. Applied by `LayoutRenderer` and sent in `LAYOUT`.                                                       | Inherits from a fixed app look; nothing for a whole game or the app.                                                                                                                                           |

The app has no backend (ADR 0001) and must work offline (ADR 0010), so everything a theme
needs has to live in IndexedDB or the bundle and reach remote surfaces over the existing
transport (ADR 0015).

---

## Decision

### 1. One token set, used everywhere

A theme is a set of values for a fixed list of **semantic tokens**. Components only use these:

| Token           | Today's variable     | Use                               |
| --------------- | -------------------- | --------------------------------- |
| `bg`            | `--color-cream`      | Page background                   |
| `surface`       | `--color-surface`    | Cards, panels, inputs             |
| `text`          | `--color-ink`        | Body text, primary buttons        |
| `muted`         | `--color-muted`      | Secondary text                    |
| `border`        | `--color-border`     | Borders, dividers                 |
| `accent`        | `--color-gold`       | Highlights, links, focus, markers |
| `accent-subtle` | `--color-gold-light` | Accent backgrounds                |
| `on-accent`     | new                  | Text on an `accent` background    |
| `positive`      | `--color-green`      | Correct, connected                |
| `negative`      | `--color-red`        | Wrong, errors, destructive        |

The tokens are declared in a Tailwind v4 `@theme` block, so components use classes
(`bg-surface`, `text-muted`, `border-border`) instead of `style={{ color: 'var(--…)' }}`,
which also brings the code in line with the Tailwind-only rule. The palette names stay as
deprecated aliases until the migration is done, then are removed.

### 2. A theme is data, and mode stays separate

```ts
interface Theme {
  id: string
  name: string
  builtIn: boolean // built-ins live in code, not in Dexie
  light: Palette // every token, #rrggbb
  dark: Palette | null // null: light-only theme (see below)
  fonts: { display: FontKey; body: FontKey; mono: FontKey }
  icons: { stroke: 1.5 | 1.75 | 2 | 2.5 }
  logo: { wordmark: LogoSrc | null; mark: LogoSrc | null }
}
```

- The existing `system`/`light`/`dark` setting stays and picks which palette applies. A theme
  with `dark: null` uses the built-in dark palette with its own `accent` in dark mode, so a
  host can brand a game without designing two palettes.
- **Mode is always the viewer's choice.** The host picks the theme; each device picks light,
  dark or system for itself. Players get a light/dark/system switch in the player view
  (today they have none and only follow whatever their browser stored). It is saved in that
  device's own app settings and never sent over the transport. The host's mode setting
  only affects the host's own screens.
- Built-in themes ship in code: **Classic** (today's look, the default) and two or three
  more, so there is something to pick before anyone designs one. User themes go in a new
  Dexie `themes` table (next schema version), are editable and included in the JSON backup.
- `on-accent` is computed (black or white, whichever contrasts more with `accent`) unless set.

### 3. Precedence: app, then game, then layout

1. **App theme**: `AppSettings.themeId` (settings version 5), default Classic. Applies to
   the admin and anywhere no game is in play.
2. **Game theme**: optional `Game.themeId`; `null` uses the app theme. This is the one a
   host sets per event.
3. **Layout overrides**: the existing `Layout.theme` from ADR 0016, unchanged. Its `null`
   fields now inherit from the game theme rather than a fixed look. `background` and
   `accent` map to `bg` and `accent`; `logo` overrides the theme's wordmark for that layout.
   A layout colour is a single value, not a light/dark pair, so on player surfaces the
   `background` and `accent` overrides apply only in light mode. In dark mode the theme's
   dark palette wins, so a player who switches to dark never gets light text on a light
   override. Shared surfaces (projector, scoreboard) apply them in both modes.

Layout themes stay as small per-screen overrides rather than becoming references to a
`Theme`: a layout is about arrangement, and making it carry a whole theme would duplicate
the game's choice on every layout.

The resolved theme is applied by setting the token variables on an element: `<html>` for the
app theme, the surface's root for the game theme, and `LayoutRenderer`'s root for layout
overrides (it already does this for `accent` and `background`).

### 4. Fonts are bundled, chosen from a list

- Drop the Google Fonts `@import`. Self-host the three current families plus a short
  curated set (a few display faces, body serifs and sans, monospace) as `woff2` files,
  for example through `@fontsource` packages, so Workbox precaches them and they work
  offline. `fonts.googleapis.com` and `fonts.gstatic.com` leave the CSP.
- A `FontKey` names one bundled family or a system stack (`system-sans`, `system-serif`,
  `system-mono`). Themes store keys, never URLs or font files, so a theme is small and a
  remote surface needs nothing but the key.
- Each family is lazy-loaded (`@font-face` with `font-display: swap`) so unused fonts cost
  precache space but not first paint. If the precache size becomes a problem, the curated
  list shrinks.
- Custom font uploads are out of scope: licensing, size on the wire and CSP make them a
  separate decision.

### 5. Icons stay Lucide

Icons keep using Lucide through `Icon`, coloured by `currentColor` and so by the tokens.
A theme sets only the stroke width, which `Icon` reads from a CSS variable. Swappable icon
sets are out of scope: every icon would need a mapping and the bundle would carry several
sets. A host's own imagery goes in logos.

### 6. Logos

- Two slots: `wordmark` (wide, for the admin header, the projector screen and the player
  join page) and `mark` (square, for compact headers and the in-app favicon).
- Stored like layout logos: a `data:image/` URL (works offline) or an `https://` URL (does
  not), validated by the same schema as `LayoutTheme.logo`. Uploads are downscaled in the
  browser to at most 512 px on the long edge and re-encoded as WebP/PNG, so they stay well
  under `MAX_LOGO_LENGTH` and cheap to send. SVG is accepted; it renders through `<img>`,
  where scripts don't run.
- The PWA manifest icons and `theme_color` stay static: the manifest is built once and the
  installed icon can't follow a per-game theme. The page's `<meta name="theme-color">` is
  updated at runtime to the active `bg`.

### 7. Remote surfaces get the resolved theme

Player phones and the projector don't have the host's database, so the host sends a new
`THEME` transport event when a player joins and whenever the game theme changes. It carries
the **resolved** theme (palettes, font keys, stroke, logos), not an id. It always carries
both palettes, with a light-only theme's dark palette filled in from the fallback, so each
player can switch between light and dark without asking the host. It carries no mode. The schema is strict:
hex colours only, font keys from the enum, logos through the existing logo schema and a total
size cap. `LAYOUT` keeps carrying layout overrides as today. Since this adds a transport
message, it needs a security review like #447 and #448.

### 8. Contrast is checked, not enforced

The theme editor shows the WCAG contrast ratio for `text` on `bg`, `text` on `surface`,
`muted` on `bg` and `on-accent` on `accent`, and warns below 4.5:1 (3:1 for large display
text). It doesn't block saving: a host projecting in a dark bar may know better.

---

## Plan

Each step is one issue and one PR, in this order. Steps 1 and 2 change nothing a user can
see and can land on their own.

1. **Token migration** (`refactor(ui)`): add the `@theme` tokens and `on-accent`, replace
   palette names, inline `style` colour props and raw hex in components with token classes,
   keep the old names as aliases. Mechanical; split by folder if the diff is too large.
2. **Self-hosted fonts** (`feat(pwa)`): bundle the current three families, add font-role
   variables (`--font-display`, `--font-body`, `--font-mono`), remove the Google Fonts
   import and CSP entries, check the precache.
3. **Theme model** (`feat(db)`): `Theme` type and zod schema, built-in themes, Dexie
   `themes` table, `AppSettings.themeId`, backup import/export, and a `resolveTheme(app,
game, layout)` helper with unit tests.
4. **Theme picker and editor** (`feat(admin)`): Settings > Appearance gets a theme picker
   and an editor (colours with contrast hints, fonts, icon stroke, logos with downscaling)
   and a live preview. Add curated fonts here.
5. **Game theme** (`feat(gamemaster)`): `Game.themeId` in the game settings form; the
   game master, screen and layout renderer apply it; layout overrides inherit from it.
6. **`THEME` transport event** (`feat(transport)`): send the resolved theme (both
   palettes) to players and the screen; they apply it. Add the light/dark/system switch to
   the player view. Needs security review.
7. **Logo placements** (`feat(ui)`): wordmark in the admin header, screen and player join
   page; mark in compact headers.

---

## Consequences

- Every surface can be branded per game, offline, with no backend.
- The token migration touches most components once; after it, a new colour or dark-mode
  fix is a change to one palette, not to every file.
- Bundling fonts grows the precache (roughly 20–40 KB per weight); the curated list is
  kept short for that reason.
- `Layout.theme` keeps its shape, so ADR 0016's data, backups and the `LAYOUT` schema don't
  change; only what `null` inherits from does.
- Players see the host's theme only after `THEME` arrives; until then they see Classic in
  the mode they chose.
- `THEME` is larger than one palette would be, but switching mode needs no round trip.
- Not covered: custom fonts, icon sets, per-player themes, and theming the installed PWA
  icon.
