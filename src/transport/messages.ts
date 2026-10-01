import { z } from 'zod'
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
/** Max length of question media (base64 data URL or remote URL), in characters. */
export const MAX_MEDIA_LENGTH = 10 * 1024 * 1024

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

/** Schema for {@link SerializedGameState}. */
export const SerializedGameStateSchema = z.strictObject({
  gameId: id,
  status: z.string().max(MAX_STATUS_LENGTH),
  currentRoundIdx: index,
  currentQuestionIdx: index,
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
    media: z.string().max(MAX_MEDIA_LENGTH).nullable(),
    mediaType: z.enum(['image', 'audio', 'video']).nullable(),
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
    deviceId: id,
    teamId: id.nullable(),
    newTeamName: name.nullable(),
  }),
  LEAVE: z.strictObject({ type: z.literal('LEAVE') }),
  FOCUS_CHANGE: z.strictObject({
    type: z.literal('FOCUS_CHANGE'),
    away: z.boolean(),
  }),
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
  PlayerEventSchemas.BUZZ,
  PlayerEventSchemas.JOIN,
  PlayerEventSchemas.LEAVE,
  PlayerEventSchemas.FOCUS_CHANGE,
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
