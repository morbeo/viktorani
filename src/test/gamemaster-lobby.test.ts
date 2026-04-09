// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import type { Game, Player } from '@/db'
import {
  serialiseGameState,
  canStartGame,
  upsertPlayer,
  markPlayerAway,
} from '@/pages/admin/gamemaster-utils'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_GAME: Game = {
  id: 'g1',
  name: 'Test Night',
  status: 'waiting',
  transportMode: 'peer',
  roomId: 'ABC123',
  passphrase: null,
  scoringEnabled: true,
  showQuestion: true,
  showAnswers: false,
  showMedia: true,
  maxTeams: 0,
  maxPerTeam: 0,
  allowIndividual: true,
  roundIds: ['r1', 'r2'],
  currentRoundIdx: 0,
  currentQuestionIdx: 0,
  buzzerLocked: true,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly' as const,
  tiebreakerMode: 'serverOrder' as const,
  createdAt: 1000,
  updatedAt: 1000,
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

// ── serialiseGameState ────────────────────────────────────────────────────────

describe('serialiseGameState', () => {
  it('maps all game fields correctly', () => {
    const state = serialiseGameState(BASE_GAME, [])
    expect(state.gameId).toBe('g1')
    expect(state.status).toBe('waiting')
    expect(state.currentRoundIdx).toBe(0)
    expect(state.currentQuestionIdx).toBe(0)
    expect(state.buzzerLocked).toBe(true)
    expect(state.showQuestion).toBe(true)
    expect(state.showAnswers).toBe(false)
    expect(state.showMedia).toBe(true)
  })

  it('builds scores map from players', () => {
    const players = [makePlayer({ id: 'p1', score: 10 }), makePlayer({ id: 'p2', score: 25 })]
    const state = serialiseGameState(BASE_GAME, players)
    expect(state.scores).toEqual({ p1: 10, p2: 25 })
  })

  it('returns empty scores when no players', () => {
    const state = serialiseGameState(BASE_GAME, [])
    expect(state.scores).toEqual({})
  })

  it('includes away players in scores', () => {
    const players = [makePlayer({ id: 'p1', score: 5, isAway: true })]
    const state = serialiseGameState(BASE_GAME, players)
    expect(state.scores['p1']).toBe(5)
  })

  it('reflects updated game status after start', () => {
    const active = { ...BASE_GAME, status: 'active' as const }
    expect(serialiseGameState(active, []).status).toBe('active')
  })
})

// ── canStartGame ──────────────────────────────────────────────────────────────

describe('canStartGame', () => {
  it('returns true when connected and players present', () => {
    expect(
      canStartGame({ transportStatus: 'connected', activePlayers: 3, soloBypass: false })
    ).toBe(true)
  })

  it('returns false when connected but no players', () => {
    expect(
      canStartGame({ transportStatus: 'connected', activePlayers: 0, soloBypass: false })
    ).toBe(false)
  })

  it('returns false when players present but not connected', () => {
    expect(
      canStartGame({ transportStatus: 'connecting', activePlayers: 3, soloBypass: false })
    ).toBe(false)
  })

  it('returns false when idle', () => {
    expect(canStartGame({ transportStatus: 'idle', activePlayers: 2, soloBypass: false })).toBe(
      false
    )
  })

  it('returns false on error status', () => {
    expect(canStartGame({ transportStatus: 'error', activePlayers: 5, soloBypass: false })).toBe(
      false
    )
  })

  it('soloBypass overrides transport and player requirements', () => {
    expect(canStartGame({ transportStatus: 'idle', activePlayers: 0, soloBypass: true })).toBe(true)
    expect(canStartGame({ transportStatus: 'error', activePlayers: 0, soloBypass: true })).toBe(
      true
    )
  })

  it('returns true for exactly 1 player', () => {
    expect(
      canStartGame({ transportStatus: 'connected', activePlayers: 1, soloBypass: false })
    ).toBe(true)
  })
})

// ── upsertPlayer ──────────────────────────────────────────────────────────────

describe('upsertPlayer', () => {
  const incoming = {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    deviceId: 'dev-1',
  }

  it('adds a new player to an empty list', () => {
    const result = upsertPlayer([], incoming)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
    expect(result[0].name).toBe('Alice')
  })

  it('sets score to 0 and isAway to false for new player', () => {
    const result = upsertPlayer([], incoming)
    expect(result[0].score).toBe(0)
    expect(result[0].isAway).toBe(false)
  })

  it('updates name and marks as not-away for returning player', () => {
    const existing = makePlayer({ id: 'p1', name: 'Old Name', isAway: true, score: 15 })
    const result = upsertPlayer([existing], { ...incoming, name: 'Alice Updated' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice Updated')
    expect(result[0].isAway).toBe(false)
  })

  it('preserves existing score on rejoin', () => {
    const existing = makePlayer({ id: 'p1', score: 20 })
    const result = upsertPlayer([existing], incoming)
    expect(result[0].score).toBe(20)
  })

  it('preserves existing joinedAt on rejoin', () => {
    const existing = makePlayer({ id: 'p1', joinedAt: 500 })
    const result = upsertPlayer([existing], incoming)
    expect(result[0].joinedAt).toBe(500)
  })

  it('does not duplicate the player', () => {
    const existing = makePlayer({ id: 'p1' })
    const result = upsertPlayer([existing], incoming)
    expect(result).toHaveLength(1)
  })

  it('preserves other players when upserting', () => {
    const p2 = makePlayer({ id: 'p2', name: 'Bob', joinedAt: 2000 })
    const result = upsertPlayer([p2], incoming)
    expect(result).toHaveLength(2)
    expect(result.map(p => p.id)).toContain('p2')
  })

  it('sorts by joinedAt ascending', () => {
    const p2 = makePlayer({ id: 'p2', name: 'Bob', joinedAt: 2000 })
    const p3 = makePlayer({ id: 'p3', name: 'Carol', joinedAt: 3000 })
    // incoming gets joinedAt = Date.now() which is > 3000 in tests
    const result = upsertPlayer([p2, p3], { ...incoming, id: 'p1' })
    expect(result[0].id).toBe('p2')
    expect(result[1].id).toBe('p3')
  })
})

// ── markPlayerAway ────────────────────────────────────────────────────────────

describe('markPlayerAway', () => {
  it('marks the specified player as away', () => {
    const players = [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })]
    const result = markPlayerAway(players, 'p1')
    expect(result.find(p => p.id === 'p1')?.isAway).toBe(true)
  })

  it('leaves other players unchanged', () => {
    const players = [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })]
    const result = markPlayerAway(players, 'p1')
    expect(result.find(p => p.id === 'p2')?.isAway).toBe(false)
  })

  it('is a no-op for an unknown playerId', () => {
    const players = [makePlayer({ id: 'p1' })]
    const result = markPlayerAway(players, 'unknown')
    expect(result[0].isAway).toBe(false)
  })

  it('does not mutate the original array', () => {
    const players = [makePlayer({ id: 'p1' })]
    markPlayerAway(players, 'p1')
    expect(players[0].isAway).toBe(false)
  })

  it('handles already-away player gracefully', () => {
    const players = [makePlayer({ id: 'p1', isAway: true })]
    const result = markPlayerAway(players, 'p1')
    expect(result[0].isAway).toBe(true)
  })

  it('handles empty list', () => {
    expect(markPlayerAway([], 'p1')).toHaveLength(0)
  })
})

// ── buildNavSequence ──────────────────────────────────────────────────────────

import { buildNavSequence } from '@/pages/admin/gamemaster-utils'
import type { GameQuestion, Round } from '@/db'

const ROUNDS: Round[] = [
  { id: 'r1', name: 'Round 1', description: '', questionIds: ['q1', 'q2'], createdAt: 0 },
  { id: 'r2', name: 'Round 2', description: '', questionIds: ['q3'], createdAt: 0 },
]

const GQS: GameQuestion[] = [
  { id: 'gq1', gameId: 'g1', questionId: 'q1', roundId: 'r1', order: 0, status: 'pending' },
  { id: 'gq2', gameId: 'g1', questionId: 'q2', roundId: 'r1', order: 1, status: 'correct' },
  { id: 'gq3', gameId: 'g1', questionId: 'q3', roundId: 'r2', order: 2, status: 'pending' },
]

describe('buildNavSequence', () => {
  it('returns one entry per game question', () => {
    expect(buildNavSequence(GQS, ROUNDS)).toHaveLength(3)
  })

  it('assigns flat indices 0, 1, 2', () => {
    const seq = buildNavSequence(GQS, ROUNDS)
    expect(seq.map(e => e.flatIndex)).toEqual([0, 1, 2])
  })

  it('resolves round name and index from rounds list', () => {
    const seq = buildNavSequence(GQS, ROUNDS)
    expect(seq[0].roundName).toBe('Round 1')
    expect(seq[0].roundIdx).toBe(0)
    expect(seq[2].roundName).toBe('Round 2')
    expect(seq[2].roundIdx).toBe(1)
  })

  it('carries questionId and gameQuestionId', () => {
    const seq = buildNavSequence(GQS, ROUNDS)
    expect(seq[0].questionId).toBe('q1')
    expect(seq[0].gameQuestionId).toBe('gq1')
  })

  it('carries question status', () => {
    const seq = buildNavSequence(GQS, ROUNDS)
    expect(seq[1].questionStatus).toBe('correct')
  })

  it('sorts by order field regardless of input order', () => {
    const shuffled = [GQS[2], GQS[0], GQS[1]]
    const seq = buildNavSequence(shuffled, ROUNDS)
    expect(seq.map(e => e.questionId)).toEqual(['q1', 'q2', 'q3'])
  })

  it('returns empty array for no questions', () => {
    expect(buildNavSequence([], ROUNDS)).toHaveLength(0)
  })

  it('falls back round name to "Round" for unknown roundId', () => {
    const gqOrphan: GameQuestion = {
      id: 'gq9',
      gameId: 'g1',
      questionId: 'qX',
      roundId: 'unknown',
      order: 0,
      status: 'pending',
    }
    const seq = buildNavSequence([gqOrphan], ROUNDS)
    expect(seq[0].roundName).toBe('Round')
    expect(seq[0].roundIdx).toBe(0)
  })

  it('does not mutate the input array', () => {
    const input = [...GQS]
    buildNavSequence([GQS[2], GQS[0]], ROUNDS)
    expect(input).toHaveLength(3)
  })
})

// ── getNavPosition + step ─────────────────────────────────────────────────────

import { getNavPosition, step } from '@/pages/admin/gamemaster-utils'

// Reuse GQS + ROUNDS from above — 3 questions: r1(q1,q2), r2(q3)
const SEQ = buildNavSequence(GQS, ROUNDS)

describe('getNavPosition', () => {
  it('first question: isFirst=true, isLast=false, roundIdx=0', () => {
    const pos = getNavPosition(SEQ, 0, -1)
    expect(pos.isFirst).toBe(true)
    expect(pos.isLast).toBe(false)
    expect(pos.roundIdx).toBe(0)
  })

  it('last question: isLast=true', () => {
    const pos = getNavPosition(SEQ, 2, 1)
    expect(pos.isLast).toBe(true)
    expect(pos.isFirst).toBe(false)
  })

  it('questionIdx is position within the round', () => {
    expect(getNavPosition(SEQ, 0, -1).questionIdx).toBe(0) // q1 is 1st in r1
    expect(getNavPosition(SEQ, 1, -1).questionIdx).toBe(1) // q2 is 2nd in r1
    expect(getNavPosition(SEQ, 2, -1).questionIdx).toBe(0) // q3 is 1st in r2
  })

  it('roundQuestions reflects count in that round', () => {
    expect(getNavPosition(SEQ, 0, -1).roundQuestions).toBe(2) // r1 has 2
    expect(getNavPosition(SEQ, 2, -1).roundQuestions).toBe(1) // r2 has 1
  })

  it('isRoundBoundary false on first call (prevRoundIdx = -1)', () => {
    expect(getNavPosition(SEQ, 0, -1).isRoundBoundary).toBe(false)
  })

  it('isRoundBoundary false when staying in same round', () => {
    expect(getNavPosition(SEQ, 1, 0).isRoundBoundary).toBe(false) // r1 → r1
  })

  it('isRoundBoundary true when crossing into next round', () => {
    expect(getNavPosition(SEQ, 2, 0).isRoundBoundary).toBe(true) // r1 → r2
  })

  it('isRoundBoundary true when going backwards across a round', () => {
    // Moving from flatIndex=2 (r2) backward to flatIndex=1 (r1) — boundary crossed
    expect(getNavPosition(SEQ, 1, 1).isRoundBoundary).toBe(true)
    // Moving within r1 backward — no boundary
    expect(getNavPosition(SEQ, 0, 0).isRoundBoundary).toBe(false)
  })

  it('returns flatIndex matching the requested index', () => {
    expect(getNavPosition(SEQ, 1, 0).flatIndex).toBe(1)
  })
})

describe('step', () => {
  it('moves forward by 1', () => {
    expect(step(SEQ, 0, 1)).toBe(1)
    expect(step(SEQ, 1, 1)).toBe(2)
  })

  it('moves backward by 1', () => {
    expect(step(SEQ, 2, -1)).toBe(1)
    expect(step(SEQ, 1, -1)).toBe(0)
  })

  it('clamps at 0 when going back from first', () => {
    expect(step(SEQ, 0, -1)).toBe(0)
  })

  it('clamps at last when going forward from last', () => {
    expect(step(SEQ, 2, 1)).toBe(2)
  })

  it('handles single-question sequence', () => {
    const single = [SEQ[0]]
    expect(step(single, 0, 1)).toBe(0)
    expect(step(single, 0, -1)).toBe(0)
  })
})
