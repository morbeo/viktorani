import { z } from 'zod'
import {
  BUILT_IN_PRESETS,
  MAX_LIMIT,
  defaultSettings,
} from '@/components/game-settings/game-settings'
import type { GamePreset, GameSettings } from '@/components/game-settings/game-settings'
import type { TiebreakerMode } from '@/db'

/** 99:59, the most the timer inputs can hold. */
export const MAX_TIMER_SECONDS = 99 * 60 + 59

/**
 * App preferences, kept in one versioned localStorage entry and included in backups.
 *
 * @remarks
 * Every field falls back to its default on a missing or invalid value, so an old or
 * hand-edited entry never breaks the app. Version history:
 * - **1**: theme, action buttons, game master control size. Read once from the old
 *   `app-theme`, `action-mode` and `gm-control-size` keys, which are then removed.
 * - **2**: sound (mute, volume) and defaults for new timers. A version 1 entry gets the
 *   defaults for the new fields.
 * - **3**: defaults for new games, including the tiebreaker mode, whether deletes ask
 *   first, and the base URL for join links. Older entries get the defaults.
 * - **4**: game setting presets. Older entries get the built-in presets.
 */
const TimerNotifySchema = z.enum(['none', 'host', 'players', 'both'])

/** True for an absolute http(s) URL. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** What the new-game wizard starts with. */
export type GameDefaults = GameSettings & { tiebreakerMode: TiebreakerMode }

const BUILT_IN_GAME: GameDefaults = { ...defaultSettings(), tiebreakerMode: 'serverOrder' }

const VisibilitySchema = z.object({
  showQuestion: z.boolean(),
  showAnswers: z.boolean(),
  showMedia: z.boolean(),
})
const LimitSchema = z.number().int().min(0).max(MAX_LIMIT)

const GameSettingsSchema = z.object({
  scoringEnabled: z.boolean().catch(BUILT_IN_GAME.scoringEnabled),
  visibility: z
    .object({ players: VisibilitySchema, screen: VisibilitySchema })
    .catch(BUILT_IN_GAME.visibility),
  maxTeams: LimitSchema.catch(BUILT_IN_GAME.maxTeams),
  maxPerTeam: LimitSchema.catch(BUILT_IN_GAME.maxPerTeam),
  maxPlayers: LimitSchema.catch(BUILT_IN_GAME.maxPlayers),
  allowIndividual: z.boolean().catch(BUILT_IN_GAME.allowIndividual),
  allowPlayerTeams: z.boolean().catch(BUILT_IN_GAME.allowPlayerTeams),
  allowLateJoin: z.boolean().catch(BUILT_IN_GAME.allowLateJoin),
  allowRejoin: z.boolean().catch(BUILT_IN_GAME.allowRejoin),
  requireApproval: z.boolean().catch(BUILT_IN_GAME.requireApproval),
  buzzerEnabled: z.boolean().catch(BUILT_IN_GAME.buzzerEnabled),
  autoLockOnFirstCorrect: z.boolean().catch(BUILT_IN_GAME.autoLockOnFirstCorrect),
  allowFalseStarts: z.boolean().catch(BUILT_IN_GAME.allowFalseStarts),
  buzzDeduplication: z.enum(['firstOnly', 'all']).catch(BUILT_IN_GAME.buzzDeduplication),
}) satisfies z.ZodType<GameSettings>

const GameDefaultsSchema = GameSettingsSchema.extend({
  tiebreakerMode: z.literal('serverOrder').catch(BUILT_IN_GAME.tiebreakerMode),
}) satisfies z.ZodType<GameDefaults>

/** The most presets kept; the rest are dropped. */
export const MAX_PRESETS = 50

const GamePresetSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).catch(''),
  settings: GameSettingsSchema.catch(() => GameSettingsSchema.parse({})),
}) satisfies z.ZodType<GamePreset>

/** Keeps every valid preset, once per id, and drops the rest. */
const PresetsSchema = z.array(z.unknown()).transform(items => {
  const seen = new Set<string>()
  const presets: GamePreset[] = []
  for (const item of items) {
    const parsed = GamePresetSchema.safeParse(item)
    if (!parsed.success || seen.has(parsed.data.id)) continue
    seen.add(parsed.data.id)
    presets.push(parsed.data)
  }
  return presets.slice(0, MAX_PRESETS)
})

export const AppSettingsSchema = z.object({
  version: z.literal(4).catch(4),
  theme: z.enum(['system', 'light', 'dark']).catch('system'),
  actionMode: z.enum(['icons', 'text', 'both']).catch('icons'),
  controlSize: z.enum(['sm', 'md', 'lg']).catch('sm'),
  soundMuted: z.boolean().catch(false),
  /** Percent, 0–100, applied to every sound the app plays. */
  soundVolume: z.number().int().min(0).max(100).catch(100),
  /** Seconds a new timer starts with. */
  timerDuration: z.number().int().min(1).max(MAX_TIMER_SECONDS).catch(60),
  timerAudioNotify: TimerNotifySchema.catch('none'),
  timerVisualNotify: TimerNotifySchema.catch('none'),
  timerAutoReset: z.enum(['none', 'question', 'round', 'any']).catch('none'),
  gameDefaults: GameDefaultsSchema.catch(() => GameDefaultsSchema.parse({})),
  /** Presets offered in the game settings form, in order. */
  gamePresets: PresetsSchema.catch(() => JSON.parse(JSON.stringify(BUILT_IN_PRESETS))),
  /** Ask before deleting questions, rounds, games and presets, and before archiving in bulk. */
  confirmDestructive: z.boolean().catch(true),
  /** Base URL for the player join link and QR code; empty means the current address. */
  joinUrlBase: z
    .string()
    .trim()
    .refine(v => v === '' || isHttpUrl(v))
    .catch(''),
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
