import type { ThemeToken } from '@/db'

/** How each colour token is named in the theme editor, in display order. */
export const TOKEN_LABELS: Readonly<Record<ThemeToken, string>> = Object.freeze({
  bg: 'Background',
  surface: 'Panels',
  text: 'Text',
  muted: 'Secondary text',
  border: 'Borders',
  accent: 'Accent',
  accentSubtle: 'Accent background',
  onAccent: 'Text on accent',
  positive: 'Positive',
  negative: 'Negative',
})

/** The text/background pairs the editor checks, and the WCAG AA ratio each should reach. */
export const CONTRAST_CHECKS: readonly { fg: ThemeToken; bg: ThemeToken; label: string }[] = [
  { fg: 'text', bg: 'bg', label: 'Text on background' },
  { fg: 'text', bg: 'surface', label: 'Text on panels' },
  { fg: 'muted', bg: 'bg', label: 'Secondary text on background' },
  { fg: 'onAccent', bg: 'accent', label: 'Text on accent' },
]

/** WCAG AA contrast for body text. */
export const MIN_CONTRAST = 4.5
