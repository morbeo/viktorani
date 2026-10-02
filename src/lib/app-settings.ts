import { z } from 'zod'

/**
 * App preferences, kept in one versioned localStorage entry and included in backups.
 *
 * @remarks
 * Every field falls back to its default on a missing or invalid value, so an old or
 * hand-edited entry never breaks the app. Version history:
 * - **1**: theme, action buttons, game master control size. Read once from the old
 *   `app-theme`, `action-mode` and `gm-control-size` keys, which are then removed.
 */
export const AppSettingsSchema = z.object({
  version: z.literal(1).catch(1),
  theme: z.enum(['system', 'light', 'dark']).catch('system'),
  actionMode: z.enum(['icons', 'text', 'both']).catch('icons'),
  controlSize: z.enum(['sm', 'md', 'lg']).catch('sm'),
})

export type AppSettings = z.infer<typeof AppSettingsSchema>
export type Theme = AppSettings['theme']

export const SETTINGS_KEY = 'viktorani-settings'

const LEGACY_KEYS = {
  theme: 'app-theme',
  actionMode: 'action-mode',
  controlSize: 'gm-control-size',
} as const

function toSettings(value: unknown): AppSettings {
  const parsed = AppSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : AppSettingsSchema.parse({})
}

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Writes the settings; returns the stored string, or `null` when storage is unavailable. */
function writeSettings(settings: AppSettings): string | null {
  const raw = JSON.stringify(settings)
  try {
    localStorage.setItem(SETTINGS_KEY, raw)
    return raw
  } catch {
    return null
  }
}

/** The old separate keys: `app-theme` was a bare string, the others JSON. */
function readLegacy(): Record<string, unknown> {
  const legacy: Record<string, unknown> = {}
  for (const [field, key] of Object.entries(LEGACY_KEYS)) {
    const raw = readItem(key)
    if (raw === null) continue
    try {
      legacy[field] = JSON.parse(raw)
    } catch {
      legacy[field] = raw
    }
  }
  return legacy
}

function removeLegacy() {
  try {
    for (const key of Object.values(LEGACY_KEYS)) localStorage.removeItem(key)
  } catch {
    // storage unavailable — ignore
  }
}

let lastRaw: string | null | undefined
let cached: AppSettings = AppSettingsSchema.parse({})

/**
 * The current settings. Returns the same object until the stored entry changes, as
 * `useSyncExternalStore` requires. With no entry yet, migrates the old keys.
 */
export function getSettings(): AppSettings {
  const raw = readItem(SETTINGS_KEY)
  if (raw === lastRaw) return cached
  if (raw === null) {
    cached = toSettings(readLegacy())
    lastRaw = writeSettings(cached)
    if (lastRaw !== null) removeLegacy()
    return cached
  }
  try {
    cached = toSettings(JSON.parse(raw))
  } catch {
    cached = toSettings({})
  }
  lastRaw = raw
  return cached
}

const listeners = new Set<() => void>()

/** Merge `patch` into the settings, persist them and apply the theme. */
export function setSettings(patch: Partial<AppSettings>) {
  cached = toSettings({ ...getSettings(), ...patch })
  lastRaw = writeSettings(cached)
  applyTheme(cached.theme)
  listeners.forEach(l => l())
}

/** Subscribe to changes made here or in another tab. */
export function subscribeSettings(listener: () => void): () => void {
  function onStorage(e: StorageEvent) {
    if (e.key === SETTINGS_KEY || e.key === null) listener()
  }
  listeners.add(listener)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}
