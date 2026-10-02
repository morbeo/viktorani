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
  MAX_LOBBY_TEAMS,
  MAX_MEDIA_LENGTH,
  MAX_NAME_LENGTH,
  MAX_OPTIONS,
  MAX_SCORE_ENTRIES,
  MAX_SCOREBOARD_ROWS,
  MAX_STATUS_LENGTH,
  MAX_TEXT_LENGTH,
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
      visibility: {
        players: { showQuestion: true, showAnswers: false, showMedia: true },
        screen: { showQuestion: true, showAnswers: true, showMedia: false },
      },
      scores: { p1: 10, t1: 4 },
    },
  },
  VISIBILITY: {
    type: 'VISIBILITY',
    target: 'players',
    showQuestion: true,
    showAnswers: false,
    showMedia: true,
  },
  GAME_STATUS: { type: 'GAME_STATUS', status: 'paused' },
  LOBBY_INFO: {
    type: 'LOBBY_INFO',
    teams: [{ id: 'team1', name: 'Owls' }],
    allowIndividual: true,
    allowPlayerTeams: false,
  },
  JOIN_PENDING: { type: 'JOIN_PENDING' },
  JOIN_ACCEPTED: { type: 'JOIN_ACCEPTED', playerId: 'p1', teamId: 'team1' },
  JOIN_REJECTED: { type: 'JOIN_REJECTED', reason: 'Late join is closed' },
  // Nullable fields carry values here so the wrong-type checks below are meaningful
  QUESTION_CONTENT: {
    type: 'QUESTION_CONTENT',
    target: 'screen',
    questionId: 'q1',
    title: 'Capital of France?',
    description: 'Pick one',
    options: ['Paris', 'Lyon'],
    answer: 'Paris',
    media: 'https://example.com/a.png',
    mediaType: 'image',
  },
  BUZZ: { type: 'BUZZ', timestamp: 1234.5 },
  JOIN: {
    type: 'JOIN',
    playerName: 'Alice',
    deviceId: 'd1',
    teamId: 'team1',
    newTeamName: 'Owls',
  },
  LEAVE: { type: 'LEAVE' },
  FOCUS_CHANGE: { type: 'FOCUS_CHANGE', away: true },
  SCREEN_JOIN: { type: 'SCREEN_JOIN' },
  SCREEN_ACCEPTED: { type: 'SCREEN_ACCEPTED' },
  SCOREBOARD: { type: 'SCOREBOARD', rows: [{ id: 'p1', name: 'Ann', score: 10 }] },
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

  it('requires GAME_STATE visibility for both targets', () => {
    const { visibility } = FIXTURES.GAME_STATE.state
    const missing = { ...FIXTURES.GAME_STATE.state, visibility: { players: visibility.players } }
    expect(TransportEventSchema.safeParse({ type: 'GAME_STATE', state: missing }).success).toBe(
      false
    )
    const { visibility: _v, ...flat } = FIXTURES.GAME_STATE.state
    void _v
    const legacy = { ...flat, showQuestion: true, showAnswers: false, showMedia: true }
    expect(TransportEventSchema.safeParse({ type: 'GAME_STATE', state: legacy }).success).toBe(
      false
    )
  })

  it('rejects an unknown GAME_STATUS status', () => {
    expect(TransportEventSchema.safeParse({ type: 'GAME_STATUS', status: 'lobby' }).success).toBe(
      false
    )
  })

  it('accepts a JOIN with a null teamId and newTeamName', () => {
    const join = { ...FIXTURES.JOIN, teamId: null, newTeamName: null }
    expect(TransportEventSchema.safeParse(join).success).toBe(true)
  })

  it.each(['BUZZ', 'LEAVE', 'FOCUS_CHANGE'] as const)(
    'rejects a self-claimed playerId on %s',
    type => {
      expect(accepts({ ...FIXTURES[type], playerId: 'someone-else' })).toBe(false)
    }
  )

  it('rejects a self-claimed playerId on JOIN', () => {
    expect(accepts({ ...FIXTURES.JOIN, playerId: 'p1' })).toBe(false)
  })

  it('rejects a JOIN with an empty deviceId', () => {
    expect(accepts({ ...FIXTURES.JOIN, deviceId: '' })).toBe(false)
  })

  it('accepts QUESTION_CONTENT with every hidden field null', () => {
    const hidden = {
      ...FIXTURES.QUESTION_CONTENT,
      title: null,
      description: null,
      options: null,
      answer: null,
      media: null,
      mediaType: null,
    }
    expect(accepts(hidden)).toBe(true)
  })

  it('rejects an unknown visibility target', () => {
    expect(accepts({ ...FIXTURES.VISIBILITY, target: 'everyone' })).toBe(false)
    expect(accepts({ ...FIXTURES.QUESTION_CONTENT, target: 'everyone' })).toBe(false)
  })

  it('rejects extra fields on a LOBBY_INFO team', () => {
    const teams = [{ id: 'team1', name: 'Owls', score: 3 }]
    expect(accepts({ ...FIXTURES.LOBBY_INFO, teams })).toBe(false)
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
    ['JOIN.playerName', FIXTURES.JOIN, 'playerName', MAX_NAME_LENGTH],
    ['JOIN.newTeamName', FIXTURES.JOIN, 'newTeamName', MAX_NAME_LENGTH],
    ['JOIN.teamId', FIXTURES.JOIN, 'teamId', MAX_ID_LENGTH],
    ['JOIN.deviceId', FIXTURES.JOIN, 'deviceId', MAX_ID_LENGTH],
    ['JOIN_ACCEPTED.playerId', FIXTURES.JOIN_ACCEPTED, 'playerId', MAX_ID_LENGTH],
    ['JOIN_ACCEPTED.teamId', FIXTURES.JOIN_ACCEPTED, 'teamId', MAX_ID_LENGTH],
    ['JOIN_REJECTED.reason', FIXTURES.JOIN_REJECTED, 'reason', MAX_TEXT_LENGTH],
    ['QUESTION_CONTENT.questionId', FIXTURES.QUESTION_CONTENT, 'questionId', MAX_ID_LENGTH],
    ['QUESTION_CONTENT.title', FIXTURES.QUESTION_CONTENT, 'title', MAX_TEXT_LENGTH],
    ['QUESTION_CONTENT.description', FIXTURES.QUESTION_CONTENT, 'description', MAX_TEXT_LENGTH],
    ['QUESTION_CONTENT.answer', FIXTURES.QUESTION_CONTENT, 'answer', MAX_TEXT_LENGTH],
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

  it('bounds QUESTION_CONTENT options: count and length', () => {
    const q = FIXTURES.QUESTION_CONTENT
    expect(accepts({ ...q, options: Array(MAX_OPTIONS).fill('a') })).toBe(true)
    expect(accepts({ ...q, options: Array(MAX_OPTIONS + 1).fill('a') })).toBe(false)
    expect(accepts({ ...q, options: ['a'.repeat(MAX_TEXT_LENGTH + 1)] })).toBe(false)
  })

  it('bounds QUESTION_CONTENT media', () => {
    const q = FIXTURES.QUESTION_CONTENT
    expect(accepts({ ...q, media: 'a'.repeat(MAX_MEDIA_LENGTH) })).toBe(true)
    expect(accepts({ ...q, media: 'a'.repeat(MAX_MEDIA_LENGTH + 1) })).toBe(false)
  })

  it('bounds LOBBY_INFO teams: count, id and name', () => {
    const team = (i: number) => ({ id: `t${i}`, name: `Team ${i}` })
    const info = FIXTURES.LOBBY_INFO
    const many = (n: number) => Array.from({ length: n }, (_, i) => team(i))
    expect(accepts({ ...info, teams: many(MAX_LOBBY_TEAMS) })).toBe(true)
    expect(accepts({ ...info, teams: many(MAX_LOBBY_TEAMS + 1) })).toBe(false)
    expect(accepts({ ...info, teams: [{ id: 'x'.repeat(MAX_ID_LENGTH + 1), name: 'A' }] })).toBe(
      false
    )
    expect(accepts({ ...info, teams: [{ id: 't', name: 'x'.repeat(MAX_NAME_LENGTH + 1) }] })).toBe(
      false
    )
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

  it('accepts a scoreboard at the row limit and rejects one more', () => {
    const rows = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: 'Ann', score: i }))
    expect(accepts({ type: 'SCOREBOARD', rows: rows(MAX_SCOREBOARD_ROWS) })).toBe(true)
    expect(accepts({ type: 'SCOREBOARD', rows: rows(MAX_SCOREBOARD_ROWS + 1) })).toBe(false)
  })

  it('rejects an oversized scoreboard name', () => {
    const rows = [{ id: 'p1', name: 'x'.repeat(MAX_NAME_LENGTH + 1), score: 1 }]
    expect(accepts({ type: 'SCOREBOARD', rows })).toBe(false)
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
      visibility: {
        players: { showQuestion: true, showAnswers: false, showMedia: true },
        screen: { showQuestion: true, showAnswers: false, showMedia: true },
      },
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
    expect(parseTransportEvent({ ...FIXTURES.JOIN, playerName: 'x'.repeat(10_000) })).toBeNull()
  })
})
