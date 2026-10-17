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

// The theme id of the game whose page is open, if it has one. A module store rather than
// context, so the page that knows the game can set it for `AppTheme` higher up.
let gameThemeId: string | null = null
const gameThemeListeners = new Set<() => void>()

function subscribeGameTheme(listener: () => void): () => void {
  gameThemeListeners.add(listener)
  return () => gameThemeListeners.delete(listener)
}

function getGameThemeId(): string | null {
  return gameThemeId
}

function setGameThemeId(id: string | null): void {
  if (id === gameThemeId) return
  gameThemeId = id
  for (const listener of gameThemeListeners) listener()
}

/**
 * Show a game's theme on the whole page while the calling component is mounted, as the
 * game master and screen pages do. `null` or `undefined` keeps the app theme.
 */
export function useGameTheme(themeId: string | null | undefined): void {
  useEffect(() => {
    setGameThemeId(themeId ?? null)
    return () => setGameThemeId(null)
  }, [themeId])
}

/**
 * The theme the page shows: the app theme from settings, or the open game's theme (see
 * {@link useGameTheme}). A game whose theme was deleted shows the app theme.
 */
export function useAppTheme(): ResolvedTheme {
  const [{ themeId }] = useAppSettings()
  const userThemes = useUserThemes()
  const gameTheme = useSyncExternalStore(subscribeGameTheme, getGameThemeId)
  return useMemo(
    () =>
      resolveTheme({
        app: findTheme(themeId, userThemes),
        game: findGameTheme(gameTheme, userThemes),
        surface: 'admin',
      }),
    [themeId, gameTheme, userThemes]
  )
}
