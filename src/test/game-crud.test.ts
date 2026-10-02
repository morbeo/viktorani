// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/transport', () => ({
  generateRoomId: () => 'ROOM2',
}))

import { db } from '@/db'
import {
  createGame,
  cloneGame,
  deleteGame,
  nextQuestionStatus,
  updateQuestionStatus,
} from '@/db/games'
import type { Game, Round } from '@/db'

const game = {
  id: 'g1',
  name: 'Quiz',
  status: 'ended',
  roundIds: ['r1', 'r2'],
} as Game

const rounds: Round[] = [
  { id: 'r1', name: 'One', description: '', questionIds: ['q1', 'q2'], createdAt: 0 },
  { id: 'r2', name: 'Two', description: '', questionIds: ['q3'], createdAt: 0 },
]

beforeEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(db.tables.map(t => t.clear()))
})

describe('createGame', () => {
  it('writes the game and its questions numbered across rounds', async () => {
    await createGame(game, rounds)

    const gqs = await db.gameQuestions.where('gameId').equals('g1').sortBy('order')
    expect(gqs.map(gq => [gq.questionId, gq.roundId, gq.order])).toEqual([
      ['q1', 'r1', 0],
      ['q2', 'r1', 1],
      ['q3', 'r2', 2],
    ])
  })

  it('writes nothing if adding the questions fails', async () => {
    vi.spyOn(db.gameQuestions, 'bulkAdd').mockRejectedValue(new Error('boom'))

    await expect(createGame(game, rounds)).rejects.toThrow('boom')
    expect(await db.games.get('g1')).toBeUndefined()
  })
})

describe('cloneGame', () => {
  it('starts the copy unplayed, with every question pending', async () => {
    await createGame(game, rounds)
    await db.gameQuestions.where('gameId').equals('g1').modify({ status: 'correct' })

    const id = await cloneGame(game)

    expect(await db.games.get(id)).toMatchObject({ status: 'waiting', name: 'Quiz (copy)' })
    const gqs = await db.gameQuestions.where('gameId').equals(id).toArray()
    expect(gqs).toHaveLength(3)
    expect(gqs.every(gq => gq.status === 'pending')).toBe(true)
  })
})

describe('deleteGame', () => {
  it('removes the game and every row that belongs to it', async () => {
    await createGame(game, rounds)
    await createGame({ ...game, id: 'g2' }, rounds)
    for (const gameId of ['g1', 'g2']) {
      await db.teams.add({ id: `t-${gameId}`, gameId, name: 'T', color: '', icon: '', score: 0 })
      await db.players.add({ id: `p-${gameId}`, gameId } as never)
      await db.buzzEvents.add({ id: `b-${gameId}`, gameId } as never)
      await db.timers.add({ id: `tm-${gameId}`, gameId } as never)
      await db.layouts.add({ id: `l-${gameId}`, gameId } as never)
      await db.widgets.add({ id: `w-${gameId}`, layoutId: `l-${gameId}` } as never)
    }

    await deleteGame('g1')

    expect(await db.games.get('g1')).toBeUndefined()
    expect(await db.gameQuestions.where('gameId').equals('g1').count()).toBe(0)
    expect(await db.teams.get('t-g1')).toBeUndefined()
    expect(await db.players.get('p-g1')).toBeUndefined()
    expect(await db.buzzEvents.get('b-g1')).toBeUndefined()
    expect(await db.timers.get('tm-g1')).toBeUndefined()
    expect(await db.layouts.get('l-g1')).toBeUndefined()
    expect(await db.widgets.get('w-g1')).toBeUndefined()
    // Other games are untouched
    expect(await db.gameQuestions.where('gameId').equals('g2').count()).toBe(3)
    expect(await db.widgets.get('w-g2')).toBeDefined()
  })
})

describe('nextQuestionStatus', () => {
  it.each([
    ['pending', 'Correct', 'correct'],
    ['incorrect', 'Correct', 'correct'],
    ['pending', 'Incorrect', 'incorrect'],
    ['correct', 'Incorrect', 'correct'],
    ['pending', 'Skip', 'pending'],
    ['pending', 'left', 'skipped'],
    ['incorrect', 'left', 'incorrect'],
    ['skipped', 'Correct', 'correct'],
  ] as const)('%s + %s → %s', (current, event, expected) => {
    expect(nextQuestionStatus(current, event)).toBe(expected)
  })
})

describe('updateQuestionStatus', () => {
  it('writes the new status and ignores unknown questions', async () => {
    await createGame(game, rounds)
    const [gq] = await db.gameQuestions.where('gameId').equals('g1').sortBy('order')

    await updateQuestionStatus(gq.id, 'Incorrect')
    expect((await db.gameQuestions.get(gq.id))?.status).toBe('incorrect')
    await updateQuestionStatus(gq.id, 'left')
    expect((await db.gameQuestions.get(gq.id))?.status).toBe('incorrect')

    await expect(updateQuestionStatus('missing', 'Correct')).resolves.toBeUndefined()
  })
})
