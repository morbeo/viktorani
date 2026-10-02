// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { db } from '@/db'
import type { BuzzEvent, Game, GameLogEntry, ScoreEvent } from '@/db'
import { logEvent } from '@/db/game-log'
import { buildLogRows, logRowsToCsv } from '@/lib/game-log-rows'
import { GameLogPanel } from '@/components/gamemaster/GameLogPanel'

beforeEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(db.tables.map(t => t.clear()))
})

const entry = (over: Partial<GameLogEntry>): GameLogEntry => ({
  id: crypto.randomUUID(),
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

const score: ScoreEvent = {
  id: 's1',
  gameId: 'g1',
  targetId: 'p1',
  kind: 'player',
  name: 'Ann',
  from: 0,
  to: 2,
  reason: 'correct',
  questionId: 'q1',
  timestamp: 40,
}

async function waitForLog(count: number) {
  await vi.waitFor(async () => expect(await db.gameLog.count()).toBe(count))
}

describe('logEvent', () => {
  it('records an entry even inside a transaction that does not include the log', async () => {
    await db.transaction('rw', db.games, async () => {
      await db.games.add({ id: 'g1' } as Game)
      logEvent('g1', 'game_started')
    })
    await waitForLog(1)
    expect(await db.games.get('g1')).toBeDefined()
    const [saved] = await db.gameLog.toArray()
    expect(saved).toMatchObject({ gameId: 'g1', kind: 'game_started', actorId: null })
  })

  it('never throws when recording fails', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.gameLog, 'add').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => logEvent('g1', 'game_paused')).not.toThrow()
    expect(error).toHaveBeenCalled()
  })
})

describe('buildLogRows', () => {
  it('merges the log with buzzes, rulings and score changes, newest first', () => {
    const rows = buildLogRows(
      [
        entry({ at: 10, kind: 'player_kicked', subjectId: 'p1' }),
        entry({ at: 50, kind: 'question_shown', data: { round: 'One', question: 2 } }),
      ],
      [buzz({ receivedAt: 20, gmDecision: 'Correct', decidedAt: 30 })],
      [score],
      new Map([['p1', 'Ann']])
    )
    expect(rows.map(r => [r.kind, r.who, r.details])).toEqual([
      ['question_shown', '', 'One · Q2'],
      ['score_changed', 'Ann', '0 → 2 (correct answer)'],
      ['ruling', 'Ann', 'Correct'],
      ['buzz', 'Ann', ''],
      ['player_kicked', 'Ann', ''],
    ])
  })
})

describe('logRowsToCsv', () => {
  it('quotes every cell and defuses spreadsheet formulas', () => {
    const csv = logRowsToCsv([
      { id: '1', at: 0, kind: 'player_joined', who: '=HYPERLINK("x")', details: 'a "b"' },
    ])
    expect(csv.split('\r\n')[1]).toBe(
      '"1970-01-01T00:00:00.000Z","Joined","\'=HYPERLINK(""x"")","a ""b"""'
    )
  })
})

describe('GameLogPanel', () => {
  it('shows the combined log', async () => {
    await db.gameLog.add(entry({ at: 10, kind: 'buzzer_unlocked' }))
    await db.buzzEvents.add(buzz({ receivedAt: 20 }))
    render(<GameLogPanel game={{ id: 'g1', name: 'Quiz' } as Game} />)
    expect(await screen.findByText('Buzzer unlocked')).toBeInTheDocument()
    expect(screen.getByText('Buzz')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CSV/ })).toBeEnabled()
  })
})
