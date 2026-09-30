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

const id = z.string().max(MAX_ID_LENGTH)
const name = z.string().max(MAX_NAME_LENGTH)
const label = z.string().max(MAX_LABEL_LENGTH)
const index = z.number().int().nonnegative()

const scoreCountOk = (r: object) => Object.keys(r).length <= MAX_SCORE_ENTRIES
const scores = z.record(id, z.number()).refine(scoreCountOk, 'Too many score entries')

/** Schema for {@link SerializedGameState}. */
export const SerializedGameStateSchema = z.strictObject({
  gameId: id,
  status: z.string().max(MAX_STATUS_LENGTH),
  currentRoundIdx: index,
  currentQuestionIdx: index,
  buzzerLocked: z.boolean(),
  showQuestion: z.boolean(),
  showAnswers: z.boolean(),
  showMedia: z.boolean(),
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
    showQuestion: z.boolean(),
    showAnswers: z.boolean(),
    showMedia: z.boolean(),
  }),
  GAME_STATUS: z.strictObject({
    type: z.literal('GAME_STATUS'),
    status: z.enum(['active', 'paused', 'ended']),
  }),
}

/** Schemas for events sent by players to the GameMaster. */
export const PlayerEventSchemas = {
  BUZZ: z.strictObject({
    type: z.literal('BUZZ'),
    playerId: id,
    playerName: name,
    timestamp: z.number().nonnegative(),
  }),
  JOIN: z.strictObject({
    type: z.literal('JOIN'),
    playerId: id,
    playerName: name,
    teamId: id.nullable(),
    deviceId: id,
  }),
  LEAVE: z.strictObject({ type: z.literal('LEAVE'), playerId: id }),
  FOCUS_CHANGE: z.strictObject({
    type: z.literal('FOCUS_CHANGE'),
    playerId: id,
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
