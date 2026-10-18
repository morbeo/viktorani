import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Theme } from '@/db'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { ThemeMode } from '@/lib/app-settings'
import { findGameTheme, findTheme, resolveTheme } from '@/lib/theme'
import type { ResolvedTheme } from '@/lib/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribePrefersDark(listener: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  const query = matchMedia(DARK_QUERY)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

function getPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches
}

/** Whether `mode` means dark on this device right now; `system` follows the device. */
export function useIsDark(mode: ThemeMode): boolean {
  const prefersDark = useSyncExternalStore(subscribePrefersDark, getPrefersDark)
  return mode === 'dark' || (mode === 'system' && prefersDark)
}

const NO_THEMES: Theme[] = []

/** The host's own themes, live; empty until they load. */
export function useUserThemes(): Theme[] {
  return useLiveQuery(() => db.themes.orderBy('name').toArray(), []) ?? NO_THEMES
}

// The open game's theme: its id on the host, or the resolved theme the host sent to a
// player or screen. A module store rather than context, so the page that knows the game
// can set it for `AppTheme` higher up.
type PageTheme = string | ResolvedTheme | null
let pageTheme: PageTheme = null
const gameThemeListeners = new Set<() => void>()

function subscribeGameTheme(listener: () => void): () => void {
  gameThemeListeners.add(listener)
  return () => gameThemeListeners.delete(listener)
}

function getPageTheme(): PageTheme {
  return pageTheme
}

function setPageTheme(next: PageTheme): void {
  if (next === pageTheme) return
  pageTheme = next
  for (const listener of gameThemeListeners) listener()
}

/**
 * Show a game's theme on the whole page while the calling component is mounted, as the
 * game master and screen pages do. `null` or `undefined` keeps the app theme.
 */
export function useGameTheme(themeId: string | null | undefined): void {
  useEffect(() => {
    setPageTheme(themeId ?? null)
    return () => setPageTheme(null)
  }, [themeId])
}

/**
 * Show the theme a host sent (see `THEME`) on the whole page while the calling component
 * is mounted, as player phones and remote screens do. `null` keeps this device's app theme.
 */
export function useRemoteTheme(theme: ResolvedTheme | null): void {
  useEffect(() => {
    setPageTheme(theme)
    return () => setPageTheme(null)
  }, [theme])
}

/**
 * A game's theme as the host sends it: the game's own theme, or the app theme when it has
 * none. `null` while the host's themes load, so nothing is sent before it is known.
 */
export function useResolvedGameTheme(themeId: string | null | undefined): ResolvedTheme | null {
  const [{ themeId: appThemeId }] = useAppSettings()
  const userThemes = useLiveQuery(() => db.themes.toArray(), [])
  const resolved = userThemes
    ? resolveTheme({
        app: findTheme(appThemeId, userThemes),
        game: findGameTheme(themeId, userThemes),
        surface: 'admin',
      })
    : null
  // The same object until what it resolves to changes, so callers can resend on change
  const key = resolved ? JSON.stringify(resolved) : null
  return useMemo(() => (key ? (JSON.parse(key) as ResolvedTheme) : null), [key])
}

/**
 * The theme the page shows: the app theme from settings, or the open game's theme (see
 * {@link useGameTheme} and {@link useRemoteTheme}). A game whose theme was deleted shows the
 * app theme.
 */
export function useAppTheme(): ResolvedTheme {
  const [{ themeId }] = useAppSettings()
  const userThemes = useUserThemes()
  const page = useSyncExternalStore(subscribeGameTheme, getPageTheme)
  return useMemo(
    () =>
      page !== null && typeof page === 'object'
        ? page
        : resolveTheme({
            app: findTheme(themeId, userThemes),
            game: findGameTheme(page, userThemes),
            surface: 'admin',
          }),
    [themeId, page, userThemes]
  )
}
