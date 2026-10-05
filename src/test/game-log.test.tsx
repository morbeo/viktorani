// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

  it('resolves the round for rows tied to a question, from the gameQuestions/rounds lookup', () => {
    const roundByQuestion = new Map([['q1', 'Round One']])
    const rows = buildLogRows(
      [
        entry({ kind: 'question_shown', subjectId: 'q1', data: { round: 'One', question: 1 } }),
        entry({ kind: 'round_changed', data: { round: 'Round Two' } }),
        entry({ kind: 'game_started' }),
      ],
      [buzz({ questionId: 'q1' })],
      [score],
      new Map(),
      roundByQuestion
    )
    expect(rows.find(r => r.kind === 'question_shown')?.round).toBe('Round One')
    expect(rows.find(r => r.kind === 'round_changed')?.round).toBe('Round Two')
    expect(rows.find(r => r.kind === 'game_started')?.round).toBe('')
    expect(rows.find(r => r.kind === 'buzz')?.round).toBe('Round One')
    expect(rows.find(r => r.kind === 'score_changed')?.round).toBe('Round One')
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
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Buzzer unlocked')).toBeInTheDocument()
    expect(within(table).getByText('Buzz')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CSV/ })).toBeEnabled()
  })

  it('narrows rows to those matching the search text', async () => {
    await db.gameLog.add(entry({ at: 10, kind: 'buzzer_unlocked' }))
    await db.buzzEvents.add(buzz({ receivedAt: 20, playerName: 'Ann' }))
    render(<GameLogPanel game={{ id: 'g1', name: 'Quiz' } as Game} />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'ann' } })

    const table = screen.getByRole('table')
    expect(within(table).getByText('Ann')).toBeInTheDocument()
    expect(within(table).queryByText('Buzzer unlocked')).not.toBeInTheDocument()
  })

  it('narrows rows to a kind selected from the filter chips', async () => {
    await db.gameLog.add(entry({ at: 10, kind: 'buzzer_unlocked' }))
    await db.buzzEvents.add(buzz({ receivedAt: 20 }))
    render(<GameLogPanel game={{ id: 'g1', name: 'Quiz' } as Game} />)
    await screen.findByRole('table')

    fireEvent.click(screen.getByRole('button', { name: 'Buzz' }))

    const table = screen.getByRole('table')
    expect(within(table).getByText('Buzz')).toBeInTheDocument()
    expect(within(table).queryByText('Buzzer unlocked')).not.toBeInTheDocument()
  })
})
