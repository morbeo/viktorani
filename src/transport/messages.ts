import { z } from 'zod'
import type { TransportEvent } from './types'

// ── Message schemas ───────────────────────────────────────────────────────────
//
// Runtime contract for every {@link TransportEvent} variant. Schemas are strict:
// unknown fields are rejected so host/player payload drift fails loudly.
// Keep in sync with `./types` — the contract tests assert the inferred types
// match exactly.

const scores = z.record(z.string(), z.number())

/** Schema for {@link SerializedGameState}. */
export const SerializedGameStateSchema = z.strictObject({
  gameId: z.string(),
  status: z.string(),
  currentRoundIdx: z.number(),
  currentQuestionIdx: z.number(),
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
    index: z.number(),
    roundIndex: z.number(),
  }),
  BUZZER_LOCK: z.strictObject({ type: z.literal('BUZZER_LOCK') }),
  BUZZER_UNLOCK: z.strictObject({ type: z.literal('BUZZER_UNLOCK') }),
  SCORE_UPDATE: z.strictObject({ type: z.literal('SCORE_UPDATE'), scores }),
  TIMER_START: z.strictObject({
    type: z.literal('TIMER_START'),
    id: z.string(),
    duration: z.number(),
    label: z.string(),
  }),
  TIMER_PAUSE: z.strictObject({ type: z.literal('TIMER_PAUSE'), id: z.string() }),
  TIMER_RESUME: z.strictObject({ type: z.literal('TIMER_RESUME'), id: z.string() }),
  TIMER_EXPIRED: z.strictObject({
    type: z.literal('TIMER_EXPIRED'),
    id: z.string(),
    label: z.string(),
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
    playerId: z.string(),
    playerName: z.string(),
    timestamp: z.number(),
  }),
  JOIN: z.strictObject({
    type: z.literal('JOIN'),
    playerId: z.string(),
    playerName: z.string(),
    teamId: z.string().nullable(),
    deviceId: z.string(),
  }),
  LEAVE: z.strictObject({ type: z.literal('LEAVE'), playerId: z.string() }),
  FOCUS_CHANGE: z.strictObject({
    type: z.literal('FOCUS_CHANGE'),
    playerId: z.string(),
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
