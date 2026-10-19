// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Player, Team } from '@/db'
import { choiceOptions, markAnswers, recordAnswer } from '@/db/answers'
import { ruleQuestion } from '@/db/rulings'

vi.mock('@/transport', () => ({ transportManager: { send: vi.fn() } }))

import { transportManager } from '@/transport'

const GAME = { id: 'g1', scoringEnabled: true }

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    score: 0,
    presence: 'connected',
    disconnectedAt: null,
    deviceId: 'dev-a',
    joinedAt: 1,
    notes: '',
    ...overrides,
  }
}

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 't1',
    gameId: 'g1',
    name: 'Reds',
    color: '#f00',
    icon: 'Shield',
    score: 0,
    notes: '',
    ...overrides,
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all(db.tables.map(t => t.clear()))
  await db.difficulties.add({ id: 'hard', name: 'Hard', score: 3, color: '#000', order: 0 })
  await db.questions.add({
    id: 'q1',
    title: 'Capital of France?',
    type: 'multiple_choice',
    options: ['Lyon', 'Paris', 'Nice', 'Lille'],
    answer: 'Paris',
    description: '',
    difficulty: 'hard',
    tags: [],
    media: null,
    mediaType: null,
    createdAt: 0,
    updatedAt: 0,
  })
  await db.gameQuestions.add({
    id: 'gq1',
    gameId: 'g1',
    questionId: 'q1',
    roundId: 'r1',
    order: 0,
    status: 'pending',
    revealed: false,
  })
  await db.players.bulkAdd([player(), player({ id: 'p2', name: 'Bob', deviceId: 'dev-b' })])
})

const answers = () => db.answers.where('gameQuestionId').equals('gq1').toArray()
const status = async () => (await db.gameQuestions.get('gq1'))?.status

describe('choiceOptions', () => {
  it('gives true/false questions their two options and open-ended ones none', () => {
    expect(choiceOptions({ type: 'true_false', options: [] })).toEqual(['True', 'False'])
    expect(choiceOptions({ type: 'multiple_choice', options: ['A', 'B'] })).toEqual(['A', 'B'])
    expect(choiceOptions({ type: 'open_ended', options: ['x'] })).toEqual([])
  })
})

describe('recordAnswer', () => {
  it("stores a player's choice with the host's player and clock", async () => {
    expect(await recordAnswer('g1', 'gq1', 'p1', 1, 500)).toBe(true)
    expect(await answers()).toEqual([
      expect.objectContaining({
        gameId: 'g1',
        playerId: 'p1',
        teamId: null,
        choice: 1,
        receivedAt: 500,
        ruling: 'pending',
      }),
    ])
  })

  it("replaces a player's earlier choice", async () => {
    await recordAnswer('g1', 'gq1', 'p1', 0, 1)
    await recordAnswer('g1', 'gq1', 'p1', 2, 2)
    expect(await answers()).toEqual([expect.objectContaining({ choice: 2, receivedAt: 2 })])
  })

  it('keeps one answer per team, from whichever member sent it last', async () => {
    await db.teams.add(team())
    await db.players.bulkUpdate([
      { key: 'p1', changes: { teamId: 't1' } },
      { key: 'p2', changes: { teamId: 't1' } },
    ])
    await recordAnswer('g1', 'gq1', 'p1', 0, 1)
    await recordAnswer('g1', 'gq1', 'p2', 1, 2)
    expect(await answers()).toEqual([
      expect.objectContaining({ teamId: 't1', playerId: 'p2', choice: 1 }),
    ])
  })

  it('refuses an option the question does not have', async () => {
    expect(await recordAnswer('g1', 'gq1', 'p1', 4, 1)).toBe(false)
    expect(await recordAnswer('g1', 'gq1', 'p1', -1, 1)).toBe(false)
    expect(await answers()).toEqual([])
  })

  it("refuses another game's question or player", async () => {
    await db.players.add(player({ id: 'p9', gameId: 'g2', deviceId: 'dev-9' }))
    expect(await recordAnswer('g2', 'gq1', 'p9', 1, 1)).toBe(false)
    expect(await recordAnswer('g1', 'gq1', 'p9', 1, 1)).toBe(false)
    expect(await answers()).toEqual([])
  })

  it('refuses answers once the question is closed', async () => {
    await db.gameQuestions.update('gq1', { status: 'incorrect' })
    expect(await recordAnswer('g1', 'gq1', 'p1', 1, 1)).toBe(false)
  })

  it('refuses a question with no options', async () => {
    await db.questions.update('q1', { type: 'open_ended', options: [] })
    expect(await recordAnswer('g1', 'gq1', 'p1', 0, 1)).toBe(false)
  })
})

describe('markAnswers', () => {
  it('marks each answer, scores the right ones and closes the question', async () => {
    await recordAnswer('g1', 'gq1', 'p1', 1, 1)
    await recordAnswer('g1', 'gq1', 'p2', 0, 2)

    expect(await markAnswers(GAME, 'gq1')).toEqual({ correct: 1, total: 2 })

    const byPlayer = new Map((await answers()).map(a => [a.playerId, a.ruling]))
    expect(byPlayer).toEqual(
      new Map([
        ['p1', 'correct'],
        ['p2', 'incorrect'],
      ])
    )
    expect((await db.players.get('p1'))?.score).toBe(3)
    expect((await db.players.get('p2'))?.score).toBe(0)
    expect(await status()).toBe('correct')
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SCORE_UPDATE' })
    )
    const log = await db.gameLog.where('gameId').equals('g1').toArray()
    expect(log).toEqual([
      expect.objectContaining({ kind: 'answers_marked', data: { correct: 1, total: 2 } }),
    ])
  })

  it('scores several right answers', async () => {
    await recordAnswer('g1', 'gq1', 'p1', 1, 1)
    await recordAnswer('g1', 'gq1', 'p2', 1, 2)
    await markAnswers(GAME, 'gq1')
    expect((await db.players.get('p1'))?.score).toBe(3)
    expect((await db.players.get('p2'))?.score).toBe(3)
  })

  it("scores a team's right answer for the team only", async () => {
    await db.teams.add(team())
    await db.players.update('p1', { teamId: 't1' })
    await recordAnswer('g1', 'gq1', 'p1', 1, 1)
    await markAnswers(GAME, 'gq1')
    expect((await db.teams.get('t1'))?.score).toBe(3)
    expect((await db.players.get('p1'))?.score).toBe(0)
  })

  it('marks the question wrong when nobody was right', async () => {
    await recordAnswer('g1', 'gq1', 'p1', 0, 1)
    expect(await markAnswers(GAME, 'gq1')).toEqual({ correct: 0, total: 1 })
    expect(await status()).toBe('incorrect')
  })

  it('marks answers once, so running it again scores nothing more', async () => {
    await recordAnswer('g1', 'gq1', 'p1', 1, 1)
    await markAnswers(GAME, 'gq1')
    expect(await markAnswers(GAME, 'gq1')).toBeNull()
    expect((await db.players.get('p1'))?.score).toBe(3)
  })

  it('leaves the question alone when nobody answered', async () => {
    expect(await markAnswers(GAME, 'gq1')).toBeNull()
    expect(await status()).toBe('pending')
  })

  it('closes a question nobody answered as told, so no answer slips in after', async () => {
    expect(await markAnswers(GAME, 'gq1', 'skipped')).toBeNull()
    expect(await status()).toBe('skipped')
    expect(await recordAnswer('g1', 'gq1', 'p1', 1, 1)).toBe(false)
  })

  it('closes by the answers, not as told, when there are answers to mark', async () => {
    await recordAnswer('g1', 'gq1', 'p1', 1, 1)
    await markAnswers(GAME, 'gq1', 'skipped')
    expect(await status()).toBe('correct')
  })

  it('marks without scoring when scoring is off', async () => {
    await recordAnswer('g1', 'gq1', 'p1', 1, 1)
    await markAnswers({ id: 'g1', scoringEnabled: false }, 'gq1')
    expect((await answers())[0].ruling).toBe('correct')
    expect((await db.players.get('p1'))?.score).toBe(0)
    expect(await status()).toBe('correct')
  })

  it("ignores another game's question", async () => {
    await recordAnswer('g1', 'gq1', 'p1', 1, 1)
    expect(await markAnswers({ id: 'g2', scoringEnabled: true }, 'gq1')).toBeNull()
    expect((await answers())[0].ruling).toBe('pending')
  })

  it("keeps a ruling's points from adding to an answer's", async () => {
    await recordAnswer('g1', 'gq1', 'p1', 1, 1)
    await markAnswers(GAME, 'gq1')
    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'player', id: 'p1' })
    expect((await db.players.get('p1'))?.score).toBe(3)
  })
})
