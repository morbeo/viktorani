import { useMemo, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Theme } from '@/db'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { ThemeMode } from '@/lib/app-settings'
import { findTheme, resolveTheme } from '@/lib/theme'
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

/** The app theme from settings, resolved for the admin pages. */
export function useAppTheme(): ResolvedTheme {
  const [{ themeId }] = useAppSettings()
  const userThemes = useUserThemes()
  return useMemo(
    () => resolveTheme({ app: findTheme(themeId, userThemes), surface: 'admin' }),
    [themeId, userThemes]
  )
}
