// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Player, Team } from '@/db'
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
    type: 'open_ended',
    options: [],
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
  })
})

const status = async () => (await db.gameQuestions.get('gq1'))?.status

describe('ruleQuestion', () => {
  it.each(['correct', 'incorrect', 'skipped'] as const)('marks the question %s', async ruling => {
    await ruleQuestion(GAME, 'gq1', ruling)
    expect(await status()).toBe(ruling)
  })

  it("awards the question's points to a player and their team", async () => {
    await db.teams.add(team())
    await db.players.add(player({ teamId: 't1' }))

    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'player', id: 'p1' })

    expect((await db.players.get('p1'))?.score).toBe(3)
    expect((await db.teams.get('t1'))?.score).toBe(3)
    expect(await db.scoreEvents.count()).toBe(2)
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SCORE_UPDATE' })
    )
  })

  it('awards a team directly', async () => {
    await db.teams.add(team())
    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'team', id: 't1' })
    expect((await db.teams.get('t1'))?.score).toBe(3)
  })

  it('awards nothing for a wrong answer, with scoring off, or to another game', async () => {
    await db.players.bulkAdd([player(), player({ id: 'other', gameId: 'g2' })])

    await ruleQuestion(GAME, 'gq1', 'incorrect', { kind: 'player', id: 'p1' })
    await ruleQuestion({ ...GAME, scoringEnabled: false }, 'gq1', 'correct', {
      kind: 'player',
      id: 'p1',
    })
    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'player', id: 'other' })

    expect((await db.players.get('p1'))?.score).toBe(0)
    expect((await db.players.get('other'))?.score).toBe(0)
    expect(transportManager.send).not.toHaveBeenCalled()
  })

  it('replaces an earlier ruling without taking points back', async () => {
    await db.players.add(player())
    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'player', id: 'p1' })
    await ruleQuestion(GAME, 'gq1', 'incorrect')
    expect(await status()).toBe('incorrect')
    expect((await db.players.get('p1'))?.score).toBe(3)
  })

  it.each([
    ['ruled correct twice', ['correct']],
    ['ruled correct, wrong, then correct', ['incorrect', 'correct']],
  ] as const)('awards the points once when %s', async (_, after) => {
    await db.players.add(player())
    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'player', id: 'p1' })
    for (const ruling of after)
      await ruleQuestion(GAME, 'gq1', ruling, { kind: 'player', id: 'p1' })

    expect(await status()).toBe('correct')
    expect((await db.players.get('p1'))?.score).toBe(3)
    expect(await db.scoreEvents.count()).toBe(1)
  })

  it('awards the points once when two correct rulings race', async () => {
    await db.players.add(player())
    const award = { kind: 'player', id: 'p1' } as const
    await Promise.all([
      ruleQuestion(GAME, 'gq1', 'correct', award),
      ruleQuestion(GAME, 'gq1', 'correct', award),
    ])
    expect((await db.players.get('p1'))?.score).toBe(3)
  })

  it('awards nothing more when a buzz already scored the question', async () => {
    await db.players.bulkAdd([player(), player({ id: 'p2', name: 'Bob', deviceId: 'dev-b' })])
    await db.scoreEvents.add({
      id: 'se1',
      gameId: 'g1',
      targetId: 'p2',
      kind: 'player',
      name: 'Bob',
      from: 0,
      to: 3,
      reason: 'correct',
      questionId: 'q1',
      timestamp: 1,
    })

    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'player', id: 'p1' })

    expect(await status()).toBe('correct')
    expect((await db.players.get('p1'))?.score).toBe(0)
  })

  it("ignores another game's question", async () => {
    await ruleQuestion({ ...GAME, id: 'g2' }, 'gq1', 'correct')
    expect(await status()).toBe('pending')
  })

  it('logs the ruling against the question, with who got the points', async () => {
    await db.players.add(player())
    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'player', id: 'p1' })
    await vi.waitFor(async () => expect(await db.gameLog.count()).toBe(1))
    expect((await db.gameLog.toArray())[0]).toMatchObject({
      kind: 'question_ruled',
      subjectId: 'q1',
      data: { status: 'correct', name: 'Alice' },
    })
  })
})
