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
  MAX_LAYOUT_EVENT_LENGTH,
  MAX_LAYOUT_WIDGETS,
  MAX_LAYOUTS,
  MAX_LOBBY_TEAMS,
  MAX_LOG_ENTRIES,
  MAX_LOG_TEXT_LENGTH,
  MAX_MEDIA_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_OPTIONS,
  MAX_SCORE_ENTRIES,
  MAX_SCOREBOARD_ROWS,
  MAX_STATUS_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_THEME_EVENT_LENGTH,
  MAX_ROUND_ANSWERS,
} from '@/transport/messages'
import { BUILT_IN_THEMES, resolveTheme } from '@/lib/theme'
import type { SerializedGameState, TransportEvent } from '@/transport/types'
import { serialiseGameState } from '@/pages/admin/gamemaster-utils'
import type { Game } from '@/db'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOGO = 'data:image/png;base64,iVBORw0KGgo='

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
  TIMER_EXPIRED: { type: 'TIMER_EXPIRED', id: 't1', label: 'Round', audio: true, visual: false },
  GAME_STATE: {
    type: 'GAME_STATE',
    state: {
      gameId: 'g1',
      status: 'active',
      currentRoundIdx: 0,
      currentQuestionIdx: 2,
      buzzerEnabled: true,
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
  MESSAGE: { type: 'MESSAGE', text: 'Two minutes to the next round' },
  LOG: {
    type: 'LOG',
    entries: [
      { id: 'e1', at: 1000, kind: 'buzz', who: 'Ann', details: '' },
      { id: 'e2', at: 2000, kind: 'player_kicked', who: 'Bob', details: '' },
    ],
  },
  LAYOUT: {
    type: 'LAYOUT',
    target: 'player',
    gameId: 'g1',
    assignments: { all: 'l1', reveal: 'builtin:player:all' },
    layouts: [
      {
        layout: {
          id: 'l1',
          gameId: 'g1',
          name: 'Bar night',
          target: 'player',
          phase: null,
          theme: { background: '#102030', accent: null, fontScale: 1.2, logo: LOGO },
          isActive: true,
          order: 0,
        },
        widgets: [
          {
            id: 'w1',
            layoutId: 'l1',
            type: 'question',
            config: {},
            grid: { x: 0, y: 0, w: 12, h: 2 },
            breakpoints: { phone: { x: 0, y: 0, w: 12, h: 3 } },
            order: 0,
          },
        ],
      },
    ],
  },
  PHASE: { type: 'PHASE', phase: 'reveal' },
  THEME: {
    type: 'THEME',
    theme: {
      ...resolveTheme({ app: BUILT_IN_THEMES[1], surface: 'player' }),
      logo: { wordmark: LOGO, mark: null },
    },
  },
  ROUND_ANSWERS: {
    type: 'ROUND_ANSWERS',
    target: 'players',
    review: {
      roundName: 'Round 1',
      view: 'table',
      items: [
        {
          questionId: 'q1',
          number: 1,
          title: 'Capital of France?',
          answer: 'Paris',
          status: 'correct',
        },
      ],
    },
  },
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

  it('accepts a message at the length limit, rejects one longer, and accepts a clear', () => {
    expect(accepts({ type: 'MESSAGE', text: 'x'.repeat(MAX_MESSAGE_LENGTH) })).toBe(true)
    expect(accepts({ type: 'MESSAGE', text: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) })).toBe(false)
    expect(accepts({ type: 'MESSAGE', text: null })).toBe(true)
  })

  it('accepts a LOG at the entry limit and rejects one more', () => {
    const entry = (i: number) => ({ id: `e${i}`, at: i, kind: 'buzz', who: 'Ann', details: '' })
    const many = (n: number) => Array.from({ length: n }, (_, i) => entry(i))
    expect(accepts({ type: 'LOG', entries: many(MAX_LOG_ENTRIES) })).toBe(true)
    expect(accepts({ type: 'LOG', entries: many(MAX_LOG_ENTRIES + 1) })).toBe(false)
  })

  it('bounds LOG entry who/details length', () => {
    const base = { id: 'e1', at: 0, kind: 'buzz' as const }
    expect(
      accepts({
        type: 'LOG',
        entries: [{ ...base, who: 'x'.repeat(MAX_LOG_TEXT_LENGTH), details: '' }],
      })
    ).toBe(true)
    expect(
      accepts({
        type: 'LOG',
        entries: [{ ...base, who: 'x'.repeat(MAX_LOG_TEXT_LENGTH + 1), details: '' }],
      })
    ).toBe(false)
    expect(
      accepts({
        type: 'LOG',
        entries: [{ ...base, who: '', details: 'x'.repeat(MAX_LOG_TEXT_LENGTH + 1) }],
      })
    ).toBe(false)
  })

  it('rejects a LOG entry kind that is not on the public allow-list', () => {
    const entries = [{ id: 'e1', at: 0, kind: 'join_rejected', who: '', details: '' }]
    expect(accepts({ type: 'LOG', entries })).toBe(false)
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
      buzzerEnabled: true,
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

describe('LAYOUT', () => {
  const event = FIXTURES.LAYOUT
  const [bundle] = event.layouts
  const withLayout = (patch: object) => ({
    ...event,
    layouts: [{ ...bundle, layout: { ...bundle.layout, ...patch } }],
  })
  const withTheme = (patch: object) => withLayout({ theme: { ...bundle.layout.theme, ...patch } })
  const withWidget = (patch: object) => ({
    ...event,
    layouts: [{ ...bundle, widgets: [{ ...bundle.widgets[0], ...patch }] }],
  })

  it('accepts no layouts, meaning the built-in default', () => {
    expect(accepts({ ...event, layouts: [] })).toBe(true)
  })

  it('is only for players and screens', () => {
    expect(accepts({ ...event, target: 'screen' })).toBe(true)
    expect(accepts({ ...event, target: 'gamemaster' })).toBe(false)
  })

  it.each([
    'javascript:alert(1)',
    'http://example.com/logo.png',
    'data:text/html,<script>alert(1)</script>',
    'blob:https://example.com/1',
  ])('rejects the logo %s', logo => {
    expect(accepts(withTheme({ logo }))).toBe(false)
  })

  it('accepts an https logo', () => {
    expect(accepts(withTheme({ logo: 'https://example.com/logo.png' }))).toBe(true)
  })

  it.each(['red', 'url(https://x)', '#12345g', '#1234567'])('rejects the colour %s', colour => {
    expect(accepts(withTheme({ background: colour }))).toBe(false)
    expect(accepts(withTheme({ accent: colour }))).toBe(false)
  })

  it('rejects a font scale out of range', () => {
    expect(accepts(withTheme({ fontScale: 0.4 }))).toBe(false)
    expect(accepts(withTheme({ fontScale: 2.1 }))).toBe(false)
  })

  it('rejects unknown fields in the layout, theme and widgets', () => {
    expect(accepts(withLayout({ html: '<b>x</b>' }))).toBe(false)
    expect(accepts(withTheme({ css: 'body{}' }))).toBe(false)
    expect(accepts(withWidget({ style: 'color:red' }))).toBe(false)
    expect(accepts(withWidget({ breakpoints: { watch: { x: 0, y: 0, w: 1, h: 1 } } }))).toBe(false)
  })

  it('rejects an unknown widget type, target or phase', () => {
    expect(accepts(withWidget({ type: 'iframe' }))).toBe(false)
    expect(accepts(withLayout({ target: 'tv' }))).toBe(false)
    expect(accepts(withLayout({ phase: 'intermission' }))).toBe(false)
  })

  it('rejects a widget off the grid', () => {
    expect(accepts(withWidget({ grid: { x: 6, y: 0, w: 7, h: 1 } }))).toBe(false)
    expect(accepts(withWidget({ grid: { x: -1, y: 0, w: 1, h: 1 } }))).toBe(false)
    expect(accepts(withWidget({ grid: { x: 0.5, y: 0, w: 1, h: 1 } }))).toBe(false)
  })

  it('bounds widget config keys', () => {
    const config = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`k${i}`, i]))
    expect(accepts(withWidget({ config: {} }))).toBe(true)
    expect(accepts(withWidget({ config }))).toBe(false)
  })

  it('bounds the number of layouts and widgets', () => {
    const widgets = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...bundle.widgets[0], id: `w${i}` }))
    expect(
      accepts({ ...event, layouts: [{ ...bundle, widgets: widgets(MAX_LAYOUT_WIDGETS) }] })
    ).toBe(true)
    expect(
      accepts({ ...event, layouts: [{ ...bundle, widgets: widgets(MAX_LAYOUT_WIDGETS + 1) }] })
    ).toBe(false)
    expect(accepts({ ...event, layouts: Array(MAX_LAYOUTS).fill(bundle) })).toBe(true)
    expect(accepts({ ...event, layouts: Array(MAX_LAYOUTS + 1).fill(bundle) })).toBe(false)
  })

  it('caps the whole event, so several large logos cannot add up', () => {
    const logo = `data:image/png;base64,${'A'.repeat(MAX_LAYOUT_EVENT_LENGTH / 2)}`
    const big = { ...bundle, layout: { ...bundle.layout, theme: { ...bundle.layout.theme, logo } } }
    expect(accepts({ ...event, layouts: [big] })).toBe(true)
    expect(
      accepts({ ...event, layouts: [big, { ...big, layout: { ...big.layout, id: 'l2' } }] })
    ).toBe(false)
  })
})

describe('LAYOUT assignments', () => {
  const event = FIXTURES.LAYOUT

  it('accepts no choices, and rejects an unknown slot or an oversized id', () => {
    expect(accepts({ ...event, assignments: {} })).toBe(true)
    expect(accepts({ ...event, assignments: { intermission: 'l1' } })).toBe(false)
    expect(accepts({ ...event, assignments: { all: 'x'.repeat(MAX_ID_LENGTH + 1) } })).toBe(false)
    expect(accepts({ ...event, assignments: { all: 1 } })).toBe(false)
    expect(accepts({ ...event, assignments: undefined })).toBe(false)
  })
})

describe('PHASE', () => {
  it.each(['lobby', 'question', 'buzzed', 'reveal', 'scoreboard', 'ended'])('accepts %s', phase => {
    expect(accepts({ type: 'PHASE', phase })).toBe(true)
  })

  it('rejects an unknown or missing phase', () => {
    expect(accepts({ type: 'PHASE', phase: 'intermission' })).toBe(false)
    expect(accepts({ type: 'PHASE', phase: null })).toBe(false)
    expect(accepts({ type: 'PHASE' })).toBe(false)
  })
})

describe('THEME', () => {
  const event = FIXTURES.THEME
  const theme = event.theme

  it('accepts every built-in theme, resolved', () => {
    for (const app of BUILT_IN_THEMES) {
      expect(accepts({ type: 'THEME', theme: resolveTheme({ app, surface: 'player' }) })).toBe(true)
    }
  })

  it('rejects a colour that is not #rrggbb, or a missing on-accent', () => {
    for (const bg of ['red', '#fff', 'url(x)', '#12345g', 'var(--x)']) {
      expect(accepts({ ...event, theme: { ...theme, light: { ...theme.light, bg } } })).toBe(false)
    }
    expect(
      accepts({ ...event, theme: { ...theme, dark: { ...theme.dark, onAccent: null } } })
    ).toBe(false)
    expect(accepts({ ...event, theme: { ...theme, dark: null } })).toBe(false)
  })

  it('rejects an unknown font, stroke or extra field', () => {
    const fonts = { ...theme.fonts, body: 'Comic Sans' }
    expect(accepts({ ...event, theme: { ...theme, fonts } })).toBe(false)
    expect(accepts({ ...event, theme: { ...theme, iconStroke: 3 } })).toBe(false)
    expect(accepts({ ...event, theme: { ...theme, css: 'body{}' } })).toBe(false)
    expect(
      accepts({ ...event, theme: { ...theme, light: { ...theme.light, extra: '#000000' } } })
    ).toBe(false)
    expect(accepts({ ...event, mode: 'dark' })).toBe(false)
  })

  it('accepts only data:image/ or https:// logos', () => {
    for (const wordmark of ['javascript:alert(1)', 'http://x.test/a.png', 'data:text/html,x']) {
      expect(accepts({ ...event, theme: { ...theme, logo: { wordmark, mark: null } } })).toBe(false)
    }
    const https = { wordmark: 'https://x.test/a.png', mark: LOGO }
    expect(accepts({ ...event, theme: { ...theme, logo: https } })).toBe(true)
  })

  it('caps the whole event, so two large logos cannot add up', () => {
    const big = `data:image/png;base64,${'A'.repeat(MAX_THEME_EVENT_LENGTH / 2)}`
    expect(accepts({ ...event, theme: { ...theme, logo: { wordmark: big, mark: null } } })).toBe(
      true
    )
    expect(accepts({ ...event, theme: { ...theme, logo: { wordmark: big, mark: big } } })).toBe(
      false
    )
  })
})

describe('ROUND_ANSWERS', () => {
  it('accepts a closed review', () => {
    expect(
      GameEventSchemas.ROUND_ANSWERS.safeParse({
        type: 'ROUND_ANSWERS',
        target: 'screen',
        review: null,
      }).success
    ).toBe(true)
  })

  it('rejects too many answers', () => {
    const item = FIXTURES.ROUND_ANSWERS.review!.items[0]
    const review = {
      ...FIXTURES.ROUND_ANSWERS.review!,
      items: Array.from({ length: MAX_ROUND_ANSWERS + 1 }, () => item),
    }
    expect(
      GameEventSchemas.ROUND_ANSWERS.safeParse({ ...FIXTURES.ROUND_ANSWERS, review }).success
    ).toBe(false)
  })

  it('accepts a question numbered past the answer cap', () => {
    const item = { ...FIXTURES.ROUND_ANSWERS.review!.items[0], number: MAX_ROUND_ANSWERS + 1 }
    const review = { ...FIXTURES.ROUND_ANSWERS.review!, items: [item] }
    expect(
      GameEventSchemas.ROUND_ANSWERS.safeParse({ ...FIXTURES.ROUND_ANSWERS, review }).success
    ).toBe(true)
  })
})
