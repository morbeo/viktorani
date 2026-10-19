import { z } from 'zod'
import {
  GAME_PHASES,
  ICON_STROKES,
  INPUT_TYPES,
  LAYOUT_TARGETS,
  MAX_ANSWER_TEXT_LENGTH,
  WIDGET_TYPES,
} from '@/db'
import {
  FontKeySchema,
  GridRectSchema,
  HexColourSchema,
  LayoutThemeSchema,
  LogoSchema,
  ThemePaletteSchema,
} from '@/db/snapshot-schema'
import { PUBLIC_LOG_KINDS } from './types'
import type { TransportEvent } from './types'

// ── Message schemas ───────────────────────────────────────────────────────────
//
// Runtime contract for every {@link TransportEvent} variant. Schemas are strict:
// unknown fields are rejected so host/player payload drift fails loudly.
// Keep in sync with `./types` — the contract tests assert the inferred types
// match exactly.
//
// Payloads come from untrusted peers, so every string, record and number is
// bounded: oversized or non-finite values are rejected before they reach the
// host's state or UI. Note: in zod 4 `z.number()` already rejects `NaN` and
// `±Infinity`, so no explicit `.finite()` is needed.

// ── Limits ────────────────────────────────────────────────────────────────────

/** Max length of any entity id (player, team, device, game, timer). */
export const MAX_ID_LENGTH = 64
/** Max length of a player name. */
export const MAX_NAME_LENGTH = 64
/** Max length of a timer label. */
export const MAX_LABEL_LENGTH = 200
/** Max length of a game status string. */
export const MAX_STATUS_LENGTH = 32
/** Max number of entries in a scores record. */
export const MAX_SCORE_ENTRIES = 500
/** Max length of question text fields (title, description, option, answer) and join reasons. */
export const MAX_TEXT_LENGTH = 5000
/** Max number of answer options on a question. */
export const MAX_OPTIONS = 20
/** Max number of teams listed in `LOBBY_INFO`. */
export const MAX_LOBBY_TEAMS = 100
/** Max number of rows in a `SCOREBOARD`. */
export const MAX_SCOREBOARD_ROWS = 500
/** Max length of a host MESSAGE. */
export const MAX_MESSAGE_LENGTH = 280
/** Max number of entries in a LOG feed. */
export const MAX_LOG_ENTRIES = 20
/** Max length of a LOG entry's `who` or `details` text. */
export const MAX_LOG_TEXT_LENGTH = 200
/** Max length of question media (base64 data URL or remote URL), in characters. */
export const MAX_MEDIA_LENGTH = 10 * 1024 * 1024
/** Max number of layouts in a `LAYOUT`: at most one per game phase, plus the all-phase one. */
export const MAX_LAYOUTS = GAME_PHASES.length + 1
/** Max number of widgets in one layout. */
export const MAX_LAYOUT_WIDGETS = 64
/** Max number of keys in a widget's config. */
export const MAX_WIDGET_CONFIG_KEYS = 32
/**
 * Max size of a whole `LAYOUT`, in characters of JSON. Fits one inlined logo at its own
 * limit (`MAX_LOGO_LENGTH`) with room to spare, so several logos can't add up to megabytes.
 */
export const MAX_LAYOUT_EVENT_LENGTH = 3_000_000
/** Max length of a theme's name in a `THEME`. */
export const MAX_THEME_NAME_LENGTH = 60
/** Max size of a whole `THEME`, in characters of JSON; like `LAYOUT`, it fits one large logo. */
export const MAX_THEME_EVENT_LENGTH = 3_000_000
/** Most questions a round review sends. */
export const MAX_ROUND_ANSWERS = 200

const id = z.string().max(MAX_ID_LENGTH)
const name = z.string().max(MAX_NAME_LENGTH)
const label = z.string().max(MAX_LABEL_LENGTH)
const index = z.number().int().nonnegative()
const text = z.string().max(MAX_TEXT_LENGTH)
const target = z.enum(['players', 'screen'])
const targetVisibility = z.strictObject({
  showQuestion: z.boolean(),
  showAnswers: z.boolean(),
  showMedia: z.boolean(),
})

const scoreCountOk = (r: object) => Object.keys(r).length <= MAX_SCORE_ENTRIES
const scores = z.record(id, z.number()).refine(scoreCountOk, 'Too many score entries')

const logText = z.string().max(MAX_LOG_TEXT_LENGTH)
const logEntry = z.strictObject({
  id,
  at: z.number().nonnegative(),
  kind: z.enum(PUBLIC_LOG_KINDS),
  who: logText,
  details: logText,
})

// Every token set, `onAccent` included: the host resolves the theme before sending it
const resolvedPalette = z.strictObject({ ...ThemePaletteSchema.shape, onAccent: HexColourSchema })

const themePayload = z.strictObject({
  name: z.string().max(MAX_THEME_NAME_LENGTH),
  light: resolvedPalette,
  dark: resolvedPalette,
  fonts: z.strictObject({ display: FontKeySchema, body: FontKeySchema, mono: FontKeySchema }),
  iconStroke: z.literal(ICON_STROKES),
  // A data:image/ or https:// URL, as for stored themes
  logo: z.strictObject({ wordmark: LogoSchema.nullable(), mark: LogoSchema.nullable() }),
})

const layoutPayload = z.strictObject({
  layout: z.strictObject({
    id,
    gameId: id.nullable(),
    name: label,
    target: z.enum(LAYOUT_TARGETS),
    phase: z.enum(GAME_PHASES).nullable(),
    // Colours are #rrggbb and the logo a data:image/ or https:// URL, as for stored layouts
    theme: z.strictObject(LayoutThemeSchema.shape),
    isActive: z.boolean(),
    order: z.number(),
  }),
  widgets: z
    .array(
      z.strictObject({
        id,
        layoutId: id,
        type: z.enum(WIDGET_TYPES),
        // Checked against the widget type's schema before rendering (`isRenderable`)
        config: z
          .record(id, z.unknown())
          .refine(c => Object.keys(c).length <= MAX_WIDGET_CONFIG_KEYS, 'Too many config keys'),
        grid: GridRectSchema,
        breakpoints: z.strictObject({
          phone: GridRectSchema.optional(),
          tv: GridRectSchema.optional(),
        }),
        order: z.number(),
      })
    )
    .max(MAX_LAYOUT_WIDGETS),
})

/** Schema for {@link transport/types!SerializedGameState | SerializedGameState}. */
export const SerializedGameStateSchema = z.strictObject({
  gameId: id,
  status: z.string().max(MAX_STATUS_LENGTH),
  currentRoundIdx: index,
  currentQuestionIdx: index,
  inputType: z.enum(INPUT_TYPES),
  buzzerLocked: z.boolean(),
  visibility: z.strictObject({ players: targetVisibility, screen: targetVisibility }),
  scores,
})

/** Schemas for events broadcast by the GameMaster to players. */
export const GameEventSchemas = {
  SLIDE_CHANGE: z.strictObject({
    type: z.literal('SLIDE_CHANGE'),
    index,
    roundIndex: index,
  }),
  BUZZER_LOCK: z.strictObject({ type: z.literal('BUZZER_LOCK') }),
  BUZZER_UNLOCK: z.strictObject({ type: z.literal('BUZZER_UNLOCK') }),
  SCORE_UPDATE: z.strictObject({ type: z.literal('SCORE_UPDATE'), scores }),
  TIMER_START: z.strictObject({
    type: z.literal('TIMER_START'),
    id,
    duration: z.number().nonnegative(),
    label,
    remaining: z.number().nonnegative().optional(),
  }),
  TIMER_PAUSE: z.strictObject({ type: z.literal('TIMER_PAUSE'), id }),
  TIMER_RESUME: z.strictObject({ type: z.literal('TIMER_RESUME'), id }),
  TIMER_RESET: z.strictObject({
    type: z.literal('TIMER_RESET'),
    id,
    duration: z.number().nonnegative(),
  }),
  TIMER_EXPIRED: z.strictObject({
    type: z.literal('TIMER_EXPIRED'),
    id,
    label,
    audio: z.boolean(),
    visual: z.boolean(),
  }),
  GAME_STATE: z.strictObject({ type: z.literal('GAME_STATE'), state: SerializedGameStateSchema }),
  VISIBILITY: z.strictObject({
    type: z.literal('VISIBILITY'),
    target,
    showQuestion: z.boolean(),
    showAnswers: z.boolean(),
    showMedia: z.boolean(),
  }),
  GAME_STATUS: z.strictObject({
    type: z.literal('GAME_STATUS'),
    status: z.enum(['active', 'paused', 'ended']),
  }),
  LOBBY_INFO: z.strictObject({
    type: z.literal('LOBBY_INFO'),
    teams: z.array(z.strictObject({ id, name })).max(MAX_LOBBY_TEAMS),
    allowIndividual: z.boolean(),
    allowPlayerTeams: z.boolean(),
  }),
  JOIN_PENDING: z.strictObject({ type: z.literal('JOIN_PENDING') }),
  JOIN_ACCEPTED: z.strictObject({
    type: z.literal('JOIN_ACCEPTED'),
    playerId: id,
    teamId: id.nullable(),
  }),
  JOIN_REJECTED: z.strictObject({ type: z.literal('JOIN_REJECTED'), reason: text }),
  QUESTION_CONTENT: z.strictObject({
    type: z.literal('QUESTION_CONTENT'),
    target,
    questionId: id,
    title: text.nullable(),
    description: text.nullable(),
    options: z.array(text).max(MAX_OPTIONS).nullable(),
    answer: text.nullable(),
    choices: z.number().int().min(1).max(MAX_OPTIONS).nullable(),
    acceptsText: z.boolean(),
    media: z.string().max(MAX_MEDIA_LENGTH).nullable(),
    mediaType: z.enum(['image', 'audio', 'video']).nullable(),
  }),
  SCREEN_ACCEPTED: z.strictObject({ type: z.literal('SCREEN_ACCEPTED') }),
  SCOREBOARD: z.strictObject({
    type: z.literal('SCOREBOARD'),
    rows: z.array(z.strictObject({ id, name, score: z.number() })).max(MAX_SCOREBOARD_ROWS),
  }),
  MESSAGE: z.strictObject({
    type: z.literal('MESSAGE'),
    text: z.string().max(MAX_MESSAGE_LENGTH).nullable(),
  }),
  LOG: z.strictObject({
    type: z.literal('LOG'),
    entries: z.array(logEntry).max(MAX_LOG_ENTRIES),
  }),
  LAYOUT: z
    .strictObject({
      type: z.literal('LAYOUT'),
      target: z.enum(['player', 'screen']),
      gameId: id,
      layouts: z.array(layoutPayload).max(MAX_LAYOUTS),
      assignments: z.partialRecord(z.enum(['all', ...GAME_PHASES]), id),
    })
    .refine(e => JSON.stringify(e).length <= MAX_LAYOUT_EVENT_LENGTH, 'Layout too large'),
  PHASE: z.strictObject({
    type: z.literal('PHASE'),
    phase: z.enum(GAME_PHASES),
  }),
  THEME: z
    .strictObject({ type: z.literal('THEME'), theme: themePayload })
    .refine(e => JSON.stringify(e).length <= MAX_THEME_EVENT_LENGTH, 'Theme too large'),
  ROUND_ANSWERS: z.strictObject({
    type: z.literal('ROUND_ANSWERS'),
    target,
    review: z
      .strictObject({
        roundName: z.string().max(MAX_LABEL_LENGTH),
        view: z.enum(['list', 'table']),
        items: z
          .array(
            z.strictObject({
              questionId: id,
              // The question's position in its round, which can pass the item cap
              number: z.number().int().min(1),
              title: text.nullable(),
              answer: text,
              status: z.enum(['pending', 'correct', 'incorrect', 'skipped']),
            })
          )
          .max(MAX_ROUND_ANSWERS),
      })
      .nullable(),
  }),
}

/** Schemas for events sent by players to the GameMaster. */
export const PlayerEventSchemas = {
  BUZZ: z.strictObject({
    type: z.literal('BUZZ'),
    timestamp: z.number().nonnegative(),
  }),
  JOIN: z.strictObject({
    type: z.literal('JOIN'),
    playerName: name,
    deviceId: id.min(1),
    teamId: id.nullable(),
    newTeamName: name.nullable(),
  }),
  ANSWER: z
    .strictObject({
      type: z.literal('ANSWER'),
      questionId: id,
      choice: z
        .number()
        .int()
        .min(0)
        .max(MAX_OPTIONS - 1)
        .nullable(),
      text: z.string().trim().min(1).max(MAX_ANSWER_TEXT_LENGTH).nullable(),
    })
    .refine(e => (e.choice === null) !== (e.text === null), 'Send a choice or text, not both'),
  LEAVE: z.strictObject({ type: z.literal('LEAVE') }),
  FOCUS_CHANGE: z.strictObject({
    type: z.literal('FOCUS_CHANGE'),
    away: z.boolean(),
  }),
  SCREEN_JOIN: z.strictObject({ type: z.literal('SCREEN_JOIN') }),
}

/** Discriminated union of every transport message, keyed on `type`. */
export const TransportEventSchema = z.discriminatedUnion('type', [
  GameEventSchemas.SLIDE_CHANGE,
  GameEventSchemas.BUZZER_LOCK,
  GameEventSchemas.BUZZER_UNLOCK,
  GameEventSchemas.SCORE_UPDATE,
  GameEventSchemas.TIMER_START,
  GameEventSchemas.TIMER_PAUSE,
  GameEventSchemas.TIMER_RESUME,
  GameEventSchemas.TIMER_RESET,
  GameEventSchemas.TIMER_EXPIRED,
  GameEventSchemas.GAME_STATE,
  GameEventSchemas.VISIBILITY,
  GameEventSchemas.GAME_STATUS,
  GameEventSchemas.LOBBY_INFO,
  GameEventSchemas.JOIN_PENDING,
  GameEventSchemas.JOIN_ACCEPTED,
  GameEventSchemas.JOIN_REJECTED,
  GameEventSchemas.QUESTION_CONTENT,
  GameEventSchemas.SCREEN_ACCEPTED,
  GameEventSchemas.SCOREBOARD,
  GameEventSchemas.MESSAGE,
  GameEventSchemas.LOG,
  GameEventSchemas.LAYOUT,
  GameEventSchemas.PHASE,
  GameEventSchemas.THEME,
  GameEventSchemas.ROUND_ANSWERS,
  PlayerEventSchemas.BUZZ,
  PlayerEventSchemas.JOIN,
  PlayerEventSchemas.ANSWER,
  PlayerEventSchemas.LEAVE,
  PlayerEventSchemas.FOCUS_CHANGE,
  PlayerEventSchemas.SCREEN_JOIN,
])

/**
 * Validate an incoming payload against the transport contract.
 *
 * @remarks
 * In development an invalid payload throws so protocol drift is caught
 * immediately. In production it logs a warning and the event is dropped.
 *
 * @param raw - Payload as received from the wire.
 * @returns The typed event, or `null` if it was invalid (production only).
 * @throws In development, if `raw` does not match any message schema.
 */
export function parseTransportEvent(raw: unknown): TransportEvent | null {
  const result = TransportEventSchema.safeParse(raw)
  if (result.success) return result.data
  if (import.meta.env.DEV) {
    throw new Error(`[Transport] Invalid event:\n${z.prettifyError(result.error)}`)
  }
  console.warn('[Transport] Dropping invalid event', result.error.issues)
  return null
}
