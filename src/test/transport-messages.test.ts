import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest'
import type { z } from 'zod'
import {
  GameEventSchemas,
  PlayerEventSchemas,
  SerializedGameStateSchema,
  TransportEventSchema,
  parseTransportEvent,
} from '@/transport'
import {
  MAX_ID_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SCORE_ENTRIES,
  MAX_STATUS_LENGTH,
} from '@/transport/messages'
import type { SerializedGameState, TransportEvent } from '@/transport/types'
import { serialiseGameState } from '@/pages/admin/gamemaster-utils'
import type { Game } from '@/db'

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
  TIMER_RESET: { type: 'TIMER_RESET', id: 't1', duration: 60 },
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
      scores: { p1: 10, t1: 4 },
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

// ── Size limits ───────────────────────────────────────────────────────────────

/** Build a scores record with `n` entries. */
function scoresOf(n: number): Record<string, number> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, i]))
}

const accepts = (raw: unknown) => TransportEventSchema.safeParse(raw).success

describe('size limits', () => {
  it.each([
    ['BUZZ.playerName', FIXTURES.BUZZ, 'playerName', MAX_NAME_LENGTH],
    ['JOIN.playerName', FIXTURES.JOIN, 'playerName', MAX_NAME_LENGTH],
    ['BUZZ.playerId', FIXTURES.BUZZ, 'playerId', MAX_ID_LENGTH],
    ['JOIN.playerId', FIXTURES.JOIN, 'playerId', MAX_ID_LENGTH],
    ['JOIN.teamId', FIXTURES.JOIN, 'teamId', MAX_ID_LENGTH],
    ['JOIN.deviceId', FIXTURES.JOIN, 'deviceId', MAX_ID_LENGTH],
    ['LEAVE.playerId', FIXTURES.LEAVE, 'playerId', MAX_ID_LENGTH],
    ['FOCUS_CHANGE.playerId', FIXTURES.FOCUS_CHANGE, 'playerId', MAX_ID_LENGTH],
    ['TIMER_START.id', FIXTURES.TIMER_START, 'id', MAX_ID_LENGTH],
    ['TIMER_START.label', FIXTURES.TIMER_START, 'label', MAX_LABEL_LENGTH],
    ['TIMER_PAUSE.id', FIXTURES.TIMER_PAUSE, 'id', MAX_ID_LENGTH],
    ['TIMER_RESUME.id', FIXTURES.TIMER_RESUME, 'id', MAX_ID_LENGTH],
    ['TIMER_RESET.id', FIXTURES.TIMER_RESET, 'id', MAX_ID_LENGTH],
    ['TIMER_EXPIRED.id', FIXTURES.TIMER_EXPIRED, 'id', MAX_ID_LENGTH],
    ['TIMER_EXPIRED.label', FIXTURES.TIMER_EXPIRED, 'label', MAX_LABEL_LENGTH],
  ] as const)('%s accepts max length and rejects one more', (_name, fixture, field, max) => {
    expect(accepts({ ...fixture, [field]: 'a'.repeat(max) })).toBe(true)
    expect(accepts({ ...fixture, [field]: 'a'.repeat(max + 1) })).toBe(false)
  })

  it('rejects an oversized playerName (1 MB)', () => {
    expect(accepts({ ...FIXTURES.JOIN, playerName: 'x'.repeat(1_000_000) })).toBe(false)
  })

  it.each([
    ['gameId', MAX_ID_LENGTH],
    ['status', MAX_STATUS_LENGTH],
  ] as const)('GAME_STATE.state.%s is bounded', (field, max) => {
    const withValue = (v: string) => ({
      ...FIXTURES.GAME_STATE,
      state: { ...FIXTURES.GAME_STATE.state, [field]: v },
    })
    expect(accepts(withValue('a'.repeat(max)))).toBe(true)
    expect(accepts(withValue('a'.repeat(max + 1)))).toBe(false)
  })

  it('accepts a scores record at the entry limit and rejects one more', () => {
    expect(accepts({ type: 'SCORE_UPDATE', scores: scoresOf(MAX_SCORE_ENTRIES) })).toBe(true)
    expect(accepts({ type: 'SCORE_UPDATE', scores: scoresOf(MAX_SCORE_ENTRIES + 1) })).toBe(false)
  })

  it('rejects a huge scores record inside GAME_STATE', () => {
    const state = { ...FIXTURES.GAME_STATE.state, scores: scoresOf(10_000) }
    expect(accepts({ type: 'GAME_STATE', state })).toBe(false)
  })

  it('rejects an oversized scores key', () => {
    const scores = { ['k'.repeat(MAX_ID_LENGTH + 1)]: 1 }
    expect(accepts({ type: 'SCORE_UPDATE', scores })).toBe(false)
  })
})

describe('number constraints', () => {
  const NON_FINITE = [Infinity, -Infinity, NaN]

  it.each(NON_FINITE)('rejects %s in numeric fields', n => {
    expect(accepts({ ...FIXTURES.SCORE_UPDATE, scores: { p1: n } })).toBe(false)
    expect(accepts({ ...FIXTURES.BUZZ, timestamp: n })).toBe(false)
    expect(accepts({ ...FIXTURES.TIMER_START, duration: n })).toBe(false)
    expect(accepts({ ...FIXTURES.TIMER_RESET, duration: n })).toBe(false)
    expect(accepts({ ...FIXTURES.SLIDE_CHANGE, index: n })).toBe(false)
    expect(accepts({ ...FIXTURES.SLIDE_CHANGE, roundIndex: n })).toBe(false)
    const state = { ...FIXTURES.GAME_STATE.state, currentRoundIdx: n }
    expect(accepts({ type: 'GAME_STATE', state })).toBe(false)
  })

  it('rejects negative or fractional indices', () => {
    for (const n of [-1, 1.5]) {
      expect(accepts({ ...FIXTURES.SLIDE_CHANGE, index: n })).toBe(false)
      expect(accepts({ ...FIXTURES.SLIDE_CHANGE, roundIndex: n })).toBe(false)
      const state = { ...FIXTURES.GAME_STATE.state, currentQuestionIdx: n }
      expect(accepts({ type: 'GAME_STATE', state })).toBe(false)
    }
  })

  it('rejects negative durations and timestamps', () => {
    expect(accepts({ ...FIXTURES.TIMER_START, duration: -1 })).toBe(false)
    expect(accepts({ ...FIXTURES.TIMER_RESET, duration: -1 })).toBe(false)
    expect(accepts({ ...FIXTURES.BUZZ, timestamp: -1 })).toBe(false)
  })

  it('still accepts negative scores', () => {
    expect(accepts({ type: 'SCORE_UPDATE', scores: { p1: -5.5 } })).toBe(true)
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
    const event = { type: 'GAME_STATE', state: serialiseGameState(game, { p1: 7, p2: 0, t1: 3 }) }
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

  it('drops an oversized payload in production', () => {
    vi.stubEnv('DEV', false)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseTransportEvent({ ...FIXTURES.BUZZ, playerName: 'x'.repeat(10_000) })).toBeNull()
  })
})
