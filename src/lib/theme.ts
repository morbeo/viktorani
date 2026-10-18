import type { FontKey, LayoutTarget, LayoutTheme, Theme, ThemePalette, ThemeToken } from '@/db'
import { contrastRatio } from '@/lib/contrast'

/**
 * Themes (ADR 0022): the built-in ones, and how the app, game and layout levels combine
 * into the colours, fonts and logos a surface shows.
 */

/** A palette with every token set, `onAccent` included. */
export type ResolvedPalette = Record<ThemeToken, string>

/** What a surface shows: both palettes, so each device can pick light or dark itself. */
export interface ResolvedTheme {
  name: string
  light: ResolvedPalette
  dark: ResolvedPalette
  fonts: Theme['fonts']
  iconStroke: Theme['iconStroke']
  logo: Theme['logo']
}

/** Where a theme is shown: the admin pages, or one of the layout surfaces. */
export type ThemeSurface = 'admin' | LayoutTarget

/** The CSS font stack for each {@link FontKey}. */
export const FONT_STACKS: Readonly<Record<FontKey, string>> = Object.freeze({
  'playfair-display': "'Playfair Display', Georgia, serif",
  lora: "'Lora', Georgia, serif",
  'dm-mono': "'DM Mono', ui-monospace, monospace",
  oswald: "'Oswald', 'Arial Narrow', sans-serif",
  inter: "'Inter', system-ui, sans-serif",
  merriweather: "'Merriweather', Georgia, serif",
  'jetbrains-mono': "'JetBrains Mono', ui-monospace, monospace",
  'system-sans': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'system-serif': "Georgia, 'Times New Roman', serif",
  'system-mono': "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
})

/** How each {@link FontKey} is named in the theme editor. */
export const FONT_LABELS: Readonly<Record<FontKey, string>> = Object.freeze({
  'playfair-display': 'Playfair Display',
  lora: 'Lora',
  'dm-mono': 'DM Mono',
  oswald: 'Oswald',
  inter: 'Inter',
  merriweather: 'Merriweather',
  'jetbrains-mono': 'JetBrains Mono',
  'system-sans': 'System sans-serif',
  'system-serif': 'System serif',
  'system-mono': 'System monospace',
})

/** The CSS custom property for each token, as declared in `index.css`. */
export const TOKEN_VARS: Readonly<Record<ThemeToken, string>> = Object.freeze({
  bg: '--color-bg',
  surface: '--color-surface',
  text: '--color-text',
  muted: '--color-muted',
  border: '--color-border',
  accent: '--color-accent',
  accentSubtle: '--color-accent-subtle',
  onAccent: '--color-on-accent',
  positive: '--color-positive',
  negative: '--color-negative',
})

const NO_LOGO: Theme['logo'] = { wordmark: null, mark: null }

/** Today's look; the default. Its values match the palettes in `index.css`. */
const CLASSIC: Theme = {
  id: 'classic',
  name: 'Classic',
  light: {
    bg: '#f5f0e8',
    surface: '#ede8dc',
    text: '#1a1610',
    muted: '#7a6f5e',
    border: '#d4c9b5',
    accent: '#c9a84c',
    accentSubtle: '#e8d5a3',
    onAccent: '#1a1610',
    positive: '#27ae60',
    negative: '#c0392b',
  },
  dark: {
    bg: '#1a1714',
    surface: '#211e1a',
    text: '#f0ebe0',
    muted: '#8a8070',
    border: '#2e2a24',
    accent: '#d4a843',
    accentSubtle: '#3a2e18',
    onAccent: '#1a1714',
    positive: '#4caf74',
    negative: '#e05252',
  },
  fonts: { display: 'playfair-display', body: 'lora', mono: 'dm-mono' },
  iconStroke: 1.75,
  logo: NO_LOGO,
}

/** Themes that ship with the app, in picker order. Read-only; hosts duplicate them to edit. */
export const BUILT_IN_THEMES: readonly Theme[] = Object.freeze([
  CLASSIC,
  {
    id: 'pub',
    name: 'Pub',
    light: {
      bg: '#f3f1e7',
      surface: '#e7e4d4',
      text: '#1d2a22',
      muted: '#5f6b5f',
      border: '#cfcab4',
      accent: '#1f6b45',
      accentSubtle: '#cfe3d3',
      onAccent: null,
      positive: '#2f8f4e',
      negative: '#b5372b',
    },
    dark: {
      bg: '#121a15',
      surface: '#18231c',
      text: '#e9efe6',
      muted: '#8fa093',
      border: '#26352b',
      accent: '#4fb27a',
      accentSubtle: '#1d3a28',
      onAccent: null,
      positive: '#5cc282',
      negative: '#e06357',
    },
    fonts: { display: 'playfair-display', body: 'lora', mono: 'dm-mono' },
    iconStroke: 2,
    logo: NO_LOGO,
  },
  {
    id: 'modern',
    name: 'Modern',
    light: {
      bg: '#f7f8fa',
      surface: '#ffffff',
      text: '#111827',
      muted: '#6b7280',
      border: '#e5e7eb',
      accent: '#2563eb',
      accentSubtle: '#dbeafe',
      onAccent: null,
      positive: '#16a34a',
      negative: '#dc2626',
    },
    dark: {
      bg: '#0f1115',
      surface: '#171a21',
      text: '#f3f4f6',
      muted: '#9ca3af',
      border: '#272b35',
      accent: '#60a5fa',
      accentSubtle: '#1e2a44',
      onAccent: null,
      positive: '#4ade80',
      negative: '#f87171',
    },
    fonts: { display: 'system-sans', body: 'system-sans', mono: 'system-mono' },
    iconStroke: 1.5,
    logo: NO_LOGO,
  },
  {
    id: 'paper',
    name: 'Paper',
    light: {
      bg: '#ffffff',
      surface: '#f4f4f4',
      text: '#111111',
      muted: '#595959',
      border: '#dddddd',
      accent: '#c2410c',
      accentSubtle: '#fde4d8',
      onAccent: null,
      positive: '#2e7d32',
      negative: '#c62828',
    },
    dark: null,
    fonts: { display: 'playfair-display', body: 'system-serif', mono: 'system-mono' },
    iconStroke: 1.75,
    logo: NO_LOGO,
  },
])

/** The theme used when none is chosen, or the chosen one no longer exists. */
export const DEFAULT_THEME_ID = CLASSIC.id

/** Ids reserved for built-in themes. */
export const BUILT_IN_THEME_IDS: readonly string[] = BUILT_IN_THEMES.map(t => t.id)

/** The theme with `id` among the built-ins and `userThemes`, or Classic if there is none. */
export function findTheme(id: string | null | undefined, userThemes: readonly Theme[]): Theme {
  return BUILT_IN_THEMES.find(t => t.id === id) ?? userThemes.find(t => t.id === id) ?? CLASSIC
}

/**
 * A game's own theme, or `null` when it has none or its theme was deleted, so the game
 * falls back to the app theme.
 */
export function findGameTheme(
  id: string | null | undefined,
  userThemes: readonly Theme[]
): Theme | null {
  if (!id) return null
  return BUILT_IN_THEMES.find(t => t.id === id) ?? userThemes.find(t => t.id === id) ?? null
}

/** Black or white, whichever contrasts more with `background`. */
export function readableOn(background: string): string {
  const white = contrastRatio('#ffffff', background) ?? 0
  const black = contrastRatio('#000000', background) ?? 0
  return white >= black ? '#ffffff' : '#000000'
}

function complete(palette: ThemePalette): ResolvedPalette {
  return { ...palette, onAccent: palette.onAccent ?? readableOn(palette.accent) }
}

/**
 * Set a layout's colour overrides on `palette`. A new accent always gets a matching
 * `onAccent`, since the palette's one was picked for its own accent.
 */
function override(palette: ResolvedPalette, layout: LayoutTheme): ResolvedPalette {
  const next = { ...palette }
  if (layout.background) next.bg = layout.background
  if (layout.accent) {
    next.accent = layout.accent
    next.onAccent = readableOn(layout.accent)
  }
  return next
}

/**
 * Combine the levels that set a surface's look: the app theme, then the game's theme when
 * it has one, then the layout's overrides.
 *
 * @remarks
 * - A light-only theme (`dark: null`) gets Classic's dark palette with its own accent.
 * - A layout's `background` and `accent` are single colours, not light/dark pairs, so on
 *   the `player` surface they apply only to the light palette; a player who picks dark
 *   keeps the theme's dark palette. Shared surfaces apply them to both.
 * - A layout's `logo` replaces the theme's wordmark. Its `fontScale` is the renderer's job.
 */
export function resolveTheme({
  app,
  game = null,
  layout = null,
  surface,
}: {
  app: Theme
  game?: Theme | null
  layout?: LayoutTheme | null
  surface: ThemeSurface
}): ResolvedTheme {
  const theme = game ?? app
  const light = complete(theme.light)
  let dark = theme.dark
    ? complete(theme.dark)
    : { ...complete(CLASSIC.dark!), accent: light.accent, onAccent: readableOn(light.accent) }
  let lightOut = light
  let logo = theme.logo
  if (layout) {
    lightOut = override(light, layout)
    if (surface !== 'player') dark = override(dark, layout)
    if (layout.logo) logo = { ...logo, wordmark: layout.logo }
  }
  return {
    name: theme.name,
    light: lightOut,
    dark,
    fonts: theme.fonts,
    iconStroke: theme.iconStroke,
    logo,
  }
}

/** The CSS custom properties that apply `palette`, for an element's `style`. */
export function paletteVars(palette: ResolvedPalette): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [token, name] of Object.entries(TOKEN_VARS) as [ThemeToken, string][]) {
    vars[name] = palette[token]
  }
  return vars
}

/**
 * Every CSS custom property a resolved theme sets for one mode: the colour tokens, the
 * font roles and the icon stroke.
 */
export function themeVars(theme: ResolvedTheme, dark: boolean): Record<string, string> {
  return {
    ...paletteVars(dark ? theme.dark : theme.light),
    '--font-display': FONT_STACKS[theme.fonts.display],
    '--font-body': FONT_STACKS[theme.fonts.body],
    '--font-mono': FONT_STACKS[theme.fonts.mono],
    '--icon-stroke': String(theme.iconStroke),
  }
}

/**
 * The CSS custom properties for a layout's colour overrides, set on the layout's root so
 * everything else inherits from the game or app theme. Like {@link resolveTheme}, the
 * `player` surface skips them in dark mode.
 */
export function layoutVars(
  layout: LayoutTheme,
  surface: ThemeSurface,
  dark: boolean
): Record<string, string> {
  if (surface === 'player' && dark) return {}
  const vars: Record<string, string> = {}
  if (layout.background) vars[TOKEN_VARS.bg] = layout.background
  if (layout.accent) {
    vars[TOKEN_VARS.accent] = layout.accent
    vars[TOKEN_VARS.onAccent] = readableOn(layout.accent)
  }
  return vars
}
