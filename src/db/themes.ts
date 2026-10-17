import { db } from '@/db'
import type { Theme } from '@/db'
import { ThemeSchema } from '@/db/snapshot-schema'
import { getSettings, setSettings } from '@/lib/app-settings'
import { DEFAULT_THEME_ID } from '@/lib/theme'

/**
 * The host's own themes (ADR 0022). Built-in themes are read-only and never stored; a host
 * edits one by duplicating it.
 */

/** A copy of `source` with a new id, ready to edit; a built-in copy keeps nothing reserved. */
export function duplicateTheme(source: Theme, name = `${source.name} copy`): Theme {
  return {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    name: name.slice(0, 60),
  }
}

/**
 * Validate and store `theme`, adding or replacing it.
 *
 * @throws If the theme doesn't match {@link ThemeSchema}, such as a built-in id, a bad
 *   colour or an unsafe logo URL.
 */
export async function saveTheme(theme: Theme): Promise<void> {
  const parsed = ThemeSchema.parse(theme)
  await db.themes.put(parsed)
}

/**
 * Delete a theme. If it was the app theme, the app goes back to Classic; games that used it
 * fall back to the app theme when they are resolved.
 */
export async function deleteTheme(id: string): Promise<void> {
  await db.themes.delete(id)
  if (getSettings().themeId === id) setSettings({ themeId: DEFAULT_THEME_ID })
}
