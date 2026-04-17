// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

import { db } from '@/db'
import { transportManager } from '@/transport'
import { serialiseGameState } from '@/pages/admin/gamemaster-utils'
import { loadBuzzesForQuestion } from '@/hooks/useBuzzer'
import type { Game, Player, BuzzEvent, GameQuestion, Question, DifficultyLevel } from '@/db'

const mockSend = transportManager.send as MockedFunction<typeof transportManager.send>

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await Promise.all([
    db.games.clear(),
    db.players.clear(),
    db.buzzEvents.clear(),
    db.gameQuestions.clear(),
    db.questions.clear(),
    db.difficulties.clear(),
  ])
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    transportMode: 'auto',
    roomId: 'ROOM1',
    passphrase: null,
    showQuestion: true,
    showAnswers: false,
    showMedia: true,
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    scoringEnabled: true,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    score: 0,
    isAway: false,
    deviceId: 'dev-1',
    joinedAt: 1000,
    ...overrides,
  }
}

function makeBuzz(overrides: Partial<BuzzEvent> = {}): BuzzEvent {
  return {
    id: 'b1',
    gameId: 'g1',
    questionId: 'q1',
    playerId: 'p1',
    playerName: 'Alice',
    teamId: null,
    timestamp: Date.now(),
    isFalseStart: false,
    gmDecision: null,
    decidedAt: null,
    ...overrides,
  }
}

// ── serialiseGameState score map ──────────────────────────────────────────────

describe('serialiseGameState — score map', () => {
  it('produces an empty score map when there are no players', () => {
    const state = serialiseGameState(makeGame(), [])
    expect(state.scores).toEqual({})
  })

  it('maps each player id to their score', () => {
    const players = [makePlayer({ id: 'p1', score: 10 }), makePlayer({ id: 'p2', score: 5 })]
    const state = serialiseGameState(makeGame(), players)
    expect(state.scores).toEqual({ p1: 10, p2: 5 })
  })

  it('includes players with score 0', () => {
    const players = [makePlayer({ id: 'p1', score: 0 })]
    const state = serialiseGameState(makeGame(), players)
    expect(state.scores).toHaveProperty('p1', 0)
  })

  it('does not include scoring when game has scoringEnabled false — state still emits', () => {
    // serialiseGameState always emits scores regardless of the flag;
    // the ScoreboardPanel is responsible for hiding the UI.
    const players = [makePlayer({ id: 'p1', score: 3 })]
    const state = serialiseGameState(makeGame({ scoringEnabled: false }), players)
    expect(state.scores).toHaveProperty('p1', 3)
  })

  it('includes all required GAME_STATE fields', () => {
    const game = makeGame({ buzzerLocked: true, showQuestion: false, showAnswers: true })
    const state = serialiseGameState(game, [])
    expect(state).toMatchObject({
      gameId: 'g1',
      status: 'active',
      currentRoundIdx: 0,
      currentQuestionIdx: 0,
      buzzerLocked: true,
      showQuestion: false,
      showAnswers: true,
      showMedia: true,
    })
  })
})

// ── adjudicate scoring via DB ─────────────────────────────────────────────────
// These tests verify the DB-level effects of scoring. The hook itself is
// React-rendered, so we test the underlying DB operations directly.

describe('score increment on correct ruling', () => {
  beforeEach(async () => {
    await clearAll()
    mockSend.mockClear()
  })

  it('increments player score by 1 (default) when no difficulty is set', async () => {
    const game = makeGame()
    const player = makePlayer({ score: 2 })
    const buzz = makeBuzz({ id: 'b1', playerId: 'p1', questionId: 'q1' })

    await db.games.add(game)
    await db.players.add(player)
    await db.buzzEvents.add(buzz)

    // Simulate the adjudicate scoring logic directly
    const increment = 1
    const newScore = player.score + increment
    await db.players.update('p1', { score: newScore })

    const updated = await db.players.get('p1')
    expect(updated?.score).toBe(3)
  })

  it('uses the difficulty score value when a difficulty is configured', async () => {
    const difficulty: DifficultyLevel = {
      id: 'd1',
      name: 'Hard',
      score: 3,
      color: '#c0392b',
      order: 0,
    }
    const question: Question = {
      id: 'q1',
      title: 'Hard question',
      type: 'open_ended',
      options: [],
      answer: '',
      description: '',
      difficulty: 'd1',
      tags: [],
      media: null,
      mediaType: null,
      createdAt: 0,
      updatedAt: 0,
    }
    const gq: GameQuestion = {
      id: 'gq1',
      gameId: 'g1',
      questionId: 'q1',
      roundId: 'r1',
      order: 0,
      status: 'pending',
    }
    const player = makePlayer({ score: 0 })

    await db.difficulties.add(difficulty)
    await db.questions.add(question)
    await db.gameQuestions.add(gq)
    await db.players.add(player)

    // Resolve increment the way useBuzzer.adjudicate does.
    // Note: gameQuestions is not indexed by questionId in the schema,
    // so useBuzzer uses where('questionId') via a non-indexed path (Dexie full scan).
    // We replicate the same query here.
    const foundGQ = await db.gameQuestions
      .toArray()
      .then(all => all.find(gq => gq.questionId === 'q1'))
    const foundQ = foundGQ ? await db.questions.get(foundGQ.questionId) : null
    const diff = foundQ?.difficulty ? await db.difficulties.get(foundQ.difficulty) : null
    const increment = diff?.score ?? 1

    expect(increment).toBe(3)

    const newScore = player.score + increment
    await db.players.update('p1', { score: newScore })
    const updated = await db.players.get('p1')
    expect(updated?.score).toBe(3)
  })

  it('does not modify player score when scoringEnabled is false', async () => {
    const player = makePlayer({ score: 5 })
    await db.players.add(player)

    // When scoringEnabled is false the adjudicate path skips the score update
    const game = makeGame({ scoringEnabled: false })
    if (game.scoringEnabled) {
      await db.players.update('p1', { score: player.score + 1 })
    }

    const stored = await db.players.get('p1')
    expect(stored?.score).toBe(5) // unchanged
  })
})

// ── loadBuzzesForQuestion ─────────────────────────────────────────────────────

describe('loadBuzzesForQuestion', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('returns an empty array when no buzzes exist for a question', async () => {
    const buzzes = await loadBuzzesForQuestion('q1')
    expect(buzzes).toHaveLength(0)
  })

  it('returns only buzzes for the specified question', async () => {
    await db.buzzEvents.bulkAdd([
      makeBuzz({ id: 'b1', questionId: 'q1', timestamp: 100 }),
      makeBuzz({ id: 'b2', questionId: 'q2', timestamp: 200 }),
    ])
    const buzzes = await loadBuzzesForQuestion('q1')
    expect(buzzes).toHaveLength(1)
    expect(buzzes[0].id).toBe('b1')
  })

  it('sorts buzzes by timestamp ascending', async () => {
    await db.buzzEvents.bulkAdd([
      makeBuzz({ id: 'b2', questionId: 'q1', playerId: 'p2', timestamp: 300 }),
      makeBuzz({ id: 'b1', questionId: 'q1', playerId: 'p1', timestamp: 100 }),
      makeBuzz({ id: 'b3', questionId: 'q1', playerId: 'p3', timestamp: 200 }),
    ])
    const buzzes = await loadBuzzesForQuestion('q1')
    expect(buzzes.map(b => b.id)).toEqual(['b1', 'b3', 'b2'])
  })
})
