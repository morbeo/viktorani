import { describe, it, expect, vi, afterEach } from 'vitest'
import type { BuzzEvent, GameLogEntry, ScoreEvent } from '@/db'
import {
  buildLogRows,
  downloadGameLog,
  logRowsToCsv,
  logRowsToJson,
  LOG_KIND_LABELS,
} from '@/lib/game-log-rows'
import type { LogRow } from '@/lib/game-log-rows'

afterEach(() => {
  vi.restoreAllMocks()
})

const entry = (over: Partial<GameLogEntry>): GameLogEntry => ({
  id: 'e1',
  gameId: 'g1',
  at: 0,
  kind: 'game_started',
  actorId: null,
  subjectId: null,
  data: {},
  ...over,
})

const buzz = (over: Partial<BuzzEvent>): BuzzEvent => ({
  id: 'b1',
  gameId: 'g1',
  questionId: 'q1',
  playerId: 'p1',
  playerName: 'Ann',
  teamId: null,
  timestamp: 0,
  receivedAt: 0,
  isFalseStart: false,
  gmDecision: null,
  decidedAt: null,
  ...over,
})

const score = (over: Partial<ScoreEvent>): ScoreEvent => ({
  id: 's1',
  gameId: 'g1',
  targetId: 'p1',
  kind: 'player',
  name: 'Ann',
  from: 0,
  to: 1,
  reason: 'step',
  questionId: null,
  timestamp: 0,
  ...over,
})

const row = (over: Partial<LogRow>): LogRow => ({
  id: 'r1',
  at: 0,
  kind: 'game_started',
  who: '',
  details: '',
  ...over,
})

/** The details text buildLogRows produces for a single log entry. */
function details(e: Partial<GameLogEntry>): string {
  return buildLogRows([entry(e)], [], [], new Map())[0].details
}

describe('buildLogRows — entry details', () => {
  it.each<[string, Partial<GameLogEntry>, string]>([
    ['question shown', { kind: 'question_shown', data: { round: 'R1', question: 3 } }, 'R1 · Q3'],
    ['round changed', { kind: 'round_changed', data: { round: 'Finals' } }, 'Finals'],
    ['round changed without a round', { kind: 'round_changed', data: {} }, ''],
    ['join rejected with a reason', { kind: 'join_rejected', data: { reason: 'Full' } }, 'Full'],
    ['join rejected by the host', { kind: 'join_rejected', data: {} }, 'By the host'],
    [
      'device mismatch',
      { kind: 'device_mismatch', data: {} },
      'Different device than an existing player with this name',
    ],
    ['buzzes cleared', { kind: 'buzzes_cleared', data: { count: 4 } }, '4 removed'],
    [
      'answers marked',
      { kind: 'answers_marked', data: { correct: 2, total: 5 } },
      '2 of 5 correct',
    ],
    [
      'answer marked correct',
      { kind: 'answer_marked', data: { name: 'Owls', ruling: 'correct' } },
      'Owls: correct',
    ],
    [
      'answer marked wrong',
      { kind: 'answer_marked', data: { name: 'Owls', ruling: 'incorrect' } },
      'Owls: wrong',
    ],
    ['answer marked without a name', { kind: 'answer_marked', data: {} }, ': wrong'],
    ['question ruled correct', { kind: 'question_ruled', data: { status: 'correct' } }, 'Correct'],
    ['question ruled wrong', { kind: 'question_ruled', data: { status: 'incorrect' } }, 'Wrong'],
    ['question skipped', { kind: 'question_ruled', data: { status: 'skipped' } }, 'Skipped'],
    ['question ruled, unknown status', { kind: 'question_ruled', data: { status: 'odd' } }, 'odd'],
    [
      'question text shown on the screen',
      { kind: 'visibility_changed', data: { item: 'showQuestion', shown: true, target: 'screen' } },
      'Question text shown on the screen',
    ],
    [
      'answers hidden on player devices',
      {
        kind: 'visibility_changed',
        data: { item: 'showAnswers', shown: false, target: 'players' },
      },
      'Answers hidden on player devices',
    ],
    [
      'unknown visibility item',
      { kind: 'visibility_changed', data: { item: 'showOther', shown: true, target: 'screen' } },
      'showOther shown on the screen',
    ],
    ['other kinds with a label', { kind: 'message_sent', data: { label: 'Hello' } }, 'Hello'],
    ['other kinds without a label', { kind: 'game_paused', data: { label: 3 } }, ''],
  ])('%s', (_name, e, expected) => {
    expect(details(e)).toBe(expected)
  })
})

describe('buildLogRows — who and round', () => {
  it('prefers the stored name, then the subject, then the actor', () => {
    const names = new Map([
      ['s', 'Subject'],
      ['a', 'Actor'],
    ])
    const rows = buildLogRows(
      [
        entry({ id: '1', at: 3, data: { name: 'Stored' }, subjectId: 's' }),
        entry({ id: '2', at: 2, subjectId: 's', actorId: 'a' }),
        entry({ id: '3', at: 1, actorId: 'a' }),
        entry({ id: '4', at: 0, actorId: 'gone' }),
      ],
      [],
      [],
      names
    )
    expect(rows.map(r => r.who)).toEqual(['Stored', 'Subject', 'Actor', ''])
  })

  it('leaves the round empty for a round change without a round name', () => {
    const [r] = buildLogRows(
      [entry({ kind: 'round_changed', data: { round: 2 } })],
      [],
      [],
      new Map()
    )
    expect(r.round).toBe('')
  })

  it('marks false starts and skips rulings that have no decision time', () => {
    const rows = buildLogRows(
      [],
      [buzz({ id: 'b1', isFalseStart: true }), buzz({ id: 'b2', gmDecision: 'Skip' })],
      [],
      new Map(),
      new Map([['q1', 'Round 1']])
    )
    expect(rows.map(r => r.kind).sort()).toEqual(['buzz', 'false_start'])
    expect(rows.every(r => r.round === 'Round 1')).toBe(true)
  })

  it('labels each ruling and score reason', () => {
    const rows = buildLogRows(
      [],
      [
        buzz({ id: 'b1', gmDecision: 'Incorrect', decidedAt: 10 }),
        buzz({ id: 'b2', gmDecision: 'Skip', decidedAt: 11, questionId: 'gone' }),
      ],
      [
        score({ id: 's1', reason: 'set', from: 1, to: 5, timestamp: 20 }),
        score({ id: 's2', reason: 'retract', from: 5, to: 4, timestamp: 21, questionId: 'q1' }),
      ],
      new Map(),
      new Map([['q1', 'Round 1']])
    )
    const byId = Object.fromEntries(rows.map(r => [r.id, r]))
    expect(byId['b1:ruling'].details).toBe('Wrong')
    expect(byId['b2:ruling']).toMatchObject({ details: 'Skipped', round: '' })
    expect(byId.s1).toMatchObject({ details: '1 → 5 (set)', round: '' })
    expect(byId.s2).toMatchObject({
      details: '5 → 4 (correct answer taken back)',
      round: 'Round 1',
    })
  })
})

describe('logRowsToCsv', () => {
  it('writes a header and escapes quotes', () => {
    const csv = logRowsToCsv([row({ who: 'The "Owls"', details: 'ok' })])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('"Time","Event","Who","Details"')
    expect(lines[1]).toBe(`"1970-01-01T00:00:00.000Z","Game started","The ""Owls""","ok"`)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it.each(['+1', '-1', '@sum', '\tx'])('defuses a cell starting with %j', value => {
    const csv = logRowsToCsv([row({ who: value })])
    expect(csv).toContain(`"'${value}"`)
  })
})

describe('logRowsToJson', () => {
  it('lists the rows oldest first with readable labels', () => {
    const json = logRowsToJson([
      row({ id: 'b', at: 2000, kind: 'buzz', who: 'Ann' }),
      row({ id: 'a', at: 1000, kind: 'game_started' }),
    ])
    expect(JSON.parse(json)).toEqual([
      {
        time: '1970-01-01T00:00:01.000Z',
        kind: 'game_started',
        event: 'Game started',
        who: '',
        details: '',
      },
      { time: '1970-01-01T00:00:02.000Z', kind: 'buzz', event: 'Buzz', who: 'Ann', details: '' },
    ])
  })

  it('has a label for every kind', () => {
    for (const label of Object.values(LOG_KIND_LABELS)) expect(label).toBeTruthy()
  })
})

describe('downloadGameLog', () => {
  function stubDownload() {
    // createObjectURL and revokeObjectURL are mocked in setup.ts
    const blobs: Blob[] = []
    vi.mocked(URL.createObjectURL).mockImplementation(b => {
      blobs.push(b as Blob)
      return 'blob:log'
    })
    const revokeObjectURL = vi.mocked(URL.revokeObjectURL)
    revokeObjectURL.mockClear()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    return { blobs, revokeObjectURL, click }
  }

  it('downloads a CSV named after the game', async () => {
    const { blobs, revokeObjectURL, click } = stubDownload()
    downloadGameLog([row({ who: 'Ann' })], 'Pub Quiz: #1', 'csv')
    expect(click).toHaveBeenCalledTimes(1)
    const a = click.mock.contexts[0] as HTMLAnchorElement
    expect(a.download).toMatch(/^Pub Quiz_ _1-log-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(a.href).toBe('blob:log')
    expect(blobs[0].type).toBe('text/csv')
    expect(await blobs[0].text()).toContain('"Ann"')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:log')
  })

  it('downloads JSON and falls back to a default name', () => {
    const { blobs, click } = stubDownload()
    downloadGameLog([], '   ', 'json')
    const a = click.mock.contexts[0] as HTMLAnchorElement
    expect(a.download).toMatch(/^game-log-\d{4}-\d{2}-\d{2}\.json$/)
    expect(blobs[0].type).toBe('application/json')
  })
})
