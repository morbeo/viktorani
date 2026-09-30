import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest'
import type { z } from 'zod'
import {
  GameEventSchemas,
  PlayerEventSchemas,
  SerializedGameStateSchema,
  TransportEventSchema,
  parseTransportEvent,
} from '@/transport'
import type { SerializedGameState, TransportEvent } from '@/transport/types'
import { serialiseGameState } from '@/pages/admin/gamemaster-utils'
import type { Game, Player } from '@/db'

// ── Fixtures ──────────────────────────────────────────────────────────────────

// One valid message per type. The mapped type makes a missing variant a
// compile error, so adding a TransportEvent type forces a fixture here.
const FIXTURES: { [K in TransportEvent['type']]: Extract<TransportEvent, { type: K }> } = {
  SLIDE_CHANGE: { type: 'SLIDE_CHANGE', index: 3, roundIndex: 1 },
  BUZZER_LOCK: { type: 'BUZZER_LOCK' },
  BUZZER_UNLOCK: { type: 'BUZZER_UNLOCK' },
  SCORE_UPDATE: { type: 'SCORE_UPDATE', scores: { p1: 10, p2: -5 } },
  TIMER_START: { type: 'TIMER_START', id: 't1', duration: 60, label: 'Round' },
  TIMER_PAUSE: { type: 'TIMER_PAUSE', id: 't1' },
  TIMER_RESUME: { type: 'TIMER_RESUME', id: 't1' },
  TIMER_EXPIRED: { type: 'TIMER_EXPIRED', id: 't1', label: 'Round' },
  GAME_STATE: {
    type: 'GAME_STATE',
    state: {
      gameId: 'g1',
      status: 'active',
      currentRoundIdx: 0,
      currentQuestionIdx: 2,
      buzzerLocked: false,
      showQuestion: true,
      showAnswers: false,
      showMedia: true,
      scores: { p1: 10 },
    },
  },
  VISIBILITY: { type: 'VISIBILITY', showQuestion: true, showAnswers: false, showMedia: true },
  GAME_STATUS: { type: 'GAME_STATUS', status: 'paused' },
  BUZZ: { type: 'BUZZ', playerId: 'p1', playerName: 'Alice', timestamp: 1234.5 },
  JOIN: { type: 'JOIN', playerId: 'p1', playerName: 'Alice', teamId: 'team1', deviceId: 'd1' },
  LEAVE: { type: 'LEAVE', playerId: 'p1' },
  FOCUS_CHANGE: { type: 'FOCUS_CHANGE', playerId: 'p1', away: true },
}

const CASES = Object.values(FIXTURES).map(f => [f.type, f] as const)

/** A value of the wrong primitive type for the given field value. */
function wrongTypeFor(value: unknown): unknown {
  return typeof value === 'string' ? 1 : 'x'
}

// ── Type-level contract ───────────────────────────────────────────────────────

describe('schema ↔ type contract', () => {
  it('schema output type matches TransportEvent exactly', () => {
    expectTypeOf<z.infer<typeof TransportEventSchema>>().toEqualTypeOf<TransportEvent>()
    expectTypeOf<z.infer<typeof SerializedGameStateSchema>>().toEqualTypeOf<SerializedGameState>()
  })

  it('has exactly one schema per message type', () => {
    const schemaTypes = [...Object.keys(GameEventSchemas), ...Object.keys(PlayerEventSchemas)]
    expect(schemaTypes.sort()).toEqual(Object.keys(FIXTURES).sort())
  })
})

// ── Per-message schema tests ──────────────────────────────────────────────────

describe.each(CASES)('%s', (_type, fixture) => {
  const fields = Object.keys(fixture).filter(k => k !== 'type')

  it('accepts a valid payload unchanged', () => {
    expect(TransportEventSchema.parse(fixture)).toEqual(fixture)
  })

  it('rejects unknown extra fields', () => {
    expect(TransportEventSchema.safeParse({ ...fixture, extra: 1 }).success).toBe(false)
  })

  if (fields.length === 0) return

  it.each(fields)('rejects a payload missing "%s"', field => {
    const rest: Record<string, unknown> = { ...fixture }
    delete rest[field]
    expect(TransportEventSchema.safeParse(rest).success).toBe(false)
  })

  it.each(fields)('rejects a wrongly typed "%s"', field => {
    const value = (fixture as Record<string, unknown>)[field]
    const bad = { ...fixture, [field]: wrongTypeFor(value) }
    expect(TransportEventSchema.safeParse(bad).success).toBe(false)
  })
})

describe('TransportEventSchema', () => {
  it('rejects a renamed field', () => {
    const { timestamp, ...rest } = FIXTURES.BUZZ
    expect(TransportEventSchema.safeParse({ ...rest, clientTimestamp: timestamp }).success).toBe(
      false
    )
  })

  it('rejects an unknown message type', () => {
    expect(TransportEventSchema.safeParse({ type: 'NOPE' }).success).toBe(false)
  })

  it('rejects non-object payloads', () => {
    for (const raw of [null, undefined, 'BUZZER_LOCK', 42, []]) {
      expect(TransportEventSchema.safeParse(raw).success).toBe(false)
    }
  })

  it('rejects extra fields inside GAME_STATE.state', () => {
    const bad = { ...FIXTURES.GAME_STATE, state: { ...FIXTURES.GAME_STATE.state, extra: 1 } }
    expect(TransportEventSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects an unknown GAME_STATUS status', () => {
    expect(TransportEventSchema.safeParse({ type: 'GAME_STATUS', status: 'lobby' }).success).toBe(
      false
    )
  })

  it('accepts a JOIN with a null teamId', () => {
    expect(TransportEventSchema.safeParse({ ...FIXTURES.JOIN, teamId: null }).success).toBe(true)
  })
})

// ── Production code paths ─────────────────────────────────────────────────────

describe('production payload builders', () => {
  it('serialiseGameState output satisfies the GAME_STATE schema', () => {
    const game = {
      id: 'g1',
      status: 'active',
      currentRoundIdx: 1,
      currentQuestionIdx: 4,
      buzzerLocked: true,
      showQuestion: true,
      showAnswers: false,
      showMedia: true,
    } as Game
    const players = [{ id: 'p1', score: 7 } as Player, { id: 'p2', score: 0 } as Player]
    const event = { type: 'GAME_STATE', state: serialiseGameState(game, players) }
    expect(TransportEventSchema.safeParse(event).success).toBe(true)
  })
})

// ── parseTransportEvent ───────────────────────────────────────────────────────

describe('parseTransportEvent', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns valid events', () => {
    expect(parseTransportEvent(FIXTURES.TIMER_START)).toEqual(FIXTURES.TIMER_START)
  })

  it('throws on invalid events in development', () => {
    vi.stubEnv('DEV', true)
    expect(() => parseTransportEvent({ type: 'BUZZ' })).toThrow(/invalid event/i)
  })

  it('warns and returns null on invalid events in production', () => {
    vi.stubEnv('DEV', false)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseTransportEvent({ type: 'BUZZ' })).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })
})
