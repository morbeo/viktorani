// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import type { GameQuestion, Round } from '@/db'
import {
  answerableEntries,
  buildNavSequence,
  getNavPosition,
  orderRounds,
  step,
} from '@/pages/admin/gamemaster-utils'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 'r1',
    name: 'Round 1',
    description: '',
    questionIds: [],
    createdAt: 0,
    ...overrides,
  }
}

function makeGQ(overrides: Partial<GameQuestion> = {}): GameQuestion {
  return {
    id: 'gq1',
    gameId: 'g1',
    questionId: 'q1',
    roundId: 'r1',
    order: 0,
    status: 'pending',
    revealed: false,
    ...overrides,
  }
}

// ── buildNavSequence ──────────────────────────────────────────────────────────

describe('buildNavSequence', () => {
  it('returns an empty sequence for no questions', () => {
    const seq = buildNavSequence([], [makeRound()])
    expect(seq).toHaveLength(0)
  })

  it('assigns correct flatIndex for single-question game', () => {
    const rounds = [makeRound()]
    const gqs = [makeGQ()]
    const seq = buildNavSequence(gqs, rounds)
    expect(seq).toHaveLength(1)
    expect(seq[0].flatIndex).toBe(0)
    expect(seq[0].roundIdx).toBe(0)
    expect(seq[0].roundName).toBe('Round 1')
    expect(seq[0].questionId).toBe('q1')
    expect(seq[0].questionStatus).toBe('pending')
  })

  it('sorts questions by order field regardless of input order', () => {
    const rounds = [makeRound()]
    const gqs = [
      makeGQ({ id: 'gq3', questionId: 'q3', order: 2 }),
      makeGQ({ id: 'gq1', questionId: 'q1', order: 0 }),
      makeGQ({ id: 'gq2', questionId: 'q2', order: 1 }),
    ]
    const seq = buildNavSequence(gqs, rounds)
    expect(seq.map(e => e.questionId)).toEqual(['q1', 'q2', 'q3'])
    expect(seq.map(e => e.flatIndex)).toEqual([0, 1, 2])
  })

  it('assigns correct roundIdx and roundName across multiple rounds', () => {
    const rounds = [makeRound({ id: 'r1', name: 'Trivia' }), makeRound({ id: 'r2', name: 'Music' })]
    const gqs = [
      makeGQ({ id: 'gq1', questionId: 'q1', roundId: 'r1', order: 0 }),
      makeGQ({ id: 'gq2', questionId: 'q2', roundId: 'r2', order: 1 }),
    ]
    const seq = buildNavSequence(gqs, rounds)
    expect(seq[0].roundIdx).toBe(0)
    expect(seq[0].roundName).toBe('Trivia')
    expect(seq[1].roundIdx).toBe(1)
    expect(seq[1].roundName).toBe('Music')
  })

  it('falls back to roundIdx 0 and name "Round" for unknown roundId', () => {
    const gqs = [makeGQ({ roundId: 'missing' })]
    const seq = buildNavSequence(gqs, [])
    expect(seq[0].roundIdx).toBe(0)
    expect(seq[0].roundName).toBe('Round')
  })
})

// ── getNavPosition ────────────────────────────────────────────────────────────

describe('getNavPosition', () => {
  const rounds = [makeRound({ id: 'r1', name: 'R1' }), makeRound({ id: 'r2', name: 'R2' })]
  const gqs = [
    makeGQ({ id: 'gq1', questionId: 'q1', roundId: 'r1', order: 0 }),
    makeGQ({ id: 'gq2', questionId: 'q2', roundId: 'r1', order: 1 }),
    makeGQ({ id: 'gq3', questionId: 'q3', roundId: 'r2', order: 2 }),
  ]
  const seq = buildNavSequence(gqs, rounds)

  it('marks the first entry as isFirst', () => {
    const pos = getNavPosition(seq, 0, -1)
    expect(pos.isFirst).toBe(true)
    expect(pos.isLast).toBe(false)
  })

  it('marks the last entry as isLast', () => {
    const pos = getNavPosition(seq, 2, -1)
    expect(pos.isFirst).toBe(false)
    expect(pos.isLast).toBe(true)
  })

  it('computes questionIdx within the round correctly', () => {
    const pos0 = getNavPosition(seq, 0, -1)
    expect(pos0.questionIdx).toBe(0)
    expect(pos0.roundQuestions).toBe(2)

    const pos1 = getNavPosition(seq, 1, -1)
    expect(pos1.questionIdx).toBe(1)
    expect(pos1.roundQuestions).toBe(2)
  })

  it('detects a round boundary crossing', () => {
    // Moving from r1 (roundIdx=0) into r2 (roundIdx=1)
    const pos = getNavPosition(seq, 2, 0)
    expect(pos.isRoundBoundary).toBe(true)
  })

  it('does not flag a boundary when staying in the same round', () => {
    const pos = getNavPosition(seq, 1, 0)
    expect(pos.isRoundBoundary).toBe(false)
  })

  it('does not flag a boundary when prevRoundIdx is -1 (initial load)', () => {
    const pos = getNavPosition(seq, 0, -1)
    expect(pos.isRoundBoundary).toBe(false)
  })
})

// ── step ─────────────────────────────────────────────────────────────────────

describe('step', () => {
  const rounds = [makeRound()]
  const gqs = [
    makeGQ({ id: 'gq1', order: 0 }),
    makeGQ({ id: 'gq2', questionId: 'q2', order: 1 }),
    makeGQ({ id: 'gq3', questionId: 'q3', order: 2 }),
  ]
  const seq = buildNavSequence(gqs, rounds)

  it('moves forward by 1', () => {
    expect(step(seq, 0, 1)).toBe(1)
    expect(step(seq, 1, 1)).toBe(2)
  })

  it('moves backward by 1', () => {
    expect(step(seq, 2, -1)).toBe(1)
    expect(step(seq, 1, -1)).toBe(0)
  })

  it('clamps at the last index when already at the end', () => {
    expect(step(seq, 2, 1)).toBe(2)
  })

  it('clamps at 0 when already at the beginning', () => {
    expect(step(seq, 0, -1)).toBe(0)
  })

  it('clamps correctly for a single-entry sequence', () => {
    const single = buildNavSequence([makeGQ()], [makeRound()])
    expect(step(single, 0, 1)).toBe(0)
    expect(step(single, 0, -1)).toBe(0)
  })
})

// ── orderRounds (#249) ────────────────────────────────────────────────────────

describe('orderRounds', () => {
  // DB returns rounds by primary key (UUID), not game order
  const dbOrder = [
    makeRound({ id: 'a', name: 'Third' }),
    makeRound({ id: 'b', name: 'First' }),
    makeRound({ id: 'c', name: 'Second' }),
    makeRound({ id: 'z', name: 'Other game' }),
  ]

  it("follows the game's roundIds, not DB order", () => {
    expect(orderRounds(['b', 'c', 'a'], dbOrder).map(r => r.name)).toEqual([
      'First',
      'Second',
      'Third',
    ])
  })

  it('keeps positions when a round was deleted', () => {
    const rounds = orderRounds(['b', 'gone', 'a'], dbOrder)
    expect(rounds.map(r => r.id)).toEqual(['b', 'gone', 'a'])
    expect(rounds[1].name).toBe('Deleted round')
  })

  it('gives every round a distinct index in the nav sequence', () => {
    const gqs = [
      makeGQ({ id: 'g0', roundId: 'b', order: 0 }),
      makeGQ({ id: 'g1', roundId: 'gone', order: 1 }),
      makeGQ({ id: 'g2', roundId: 'a', order: 2 }),
    ]
    const seq = buildNavSequence(gqs, orderRounds(['b', 'gone', 'a'], dbOrder))
    expect(seq.map(e => e.roundIdx)).toEqual([0, 1, 2])
    expect(seq.map(e => e.roundName)).toEqual(['First', 'Deleted round', 'Third'])
  })
})

// ── answerableEntries ─────────────────────────────────────────────────────────

describe('answerableEntries', () => {
  // Round 1 has three questions, round 2 one
  const seq = buildNavSequence(
    [
      makeGQ({ id: 'a', questionId: 'qa', order: 0 }),
      makeGQ({ id: 'b', questionId: 'qb', order: 1 }),
      makeGQ({ id: 'c', questionId: 'qc', order: 2 }),
      makeGQ({ id: 'd', questionId: 'qd', roundId: 'r2', order: 3 }),
    ],
    [makeRound({ id: 'r1' }), makeRound({ id: 'r2', name: 'Round 2' })]
  )
  const ids = (entries: ReturnType<typeof answerableEntries>) => entries.map(e => e.gameQuestionId)

  it('is only the question shown when answers close on moving on', () => {
    expect(
      ids(answerableEntries({ inputType: 'choice', answersClose: 'perQuestion' }, seq, 1))
    ).toEqual(['b'])
  })

  it("is the round's questions shown so far when answers close at the end of the round", () => {
    expect(
      ids(answerableEntries({ inputType: 'text', answersClose: 'endOfRound' }, seq, 1))
    ).toEqual(['a', 'b'])
  })

  it('is every question of the round with the whole round on phones', () => {
    const game = { inputType: 'choice', answersClose: 'wholeRound' } as const
    expect(ids(answerableEntries(game, seq, 0))).toEqual(['a', 'b', 'c'])
    expect(ids(answerableEntries(game, seq, 3))).toEqual(['d'])
  })

  it('is only the question shown in a game that takes no answers on phones', () => {
    expect(
      ids(answerableEntries({ inputType: 'buzzer', answersClose: 'wholeRound' }, seq, 0))
    ).toEqual(['a'])
  })

  it('is empty when nothing is shown', () => {
    expect(answerableEntries({ inputType: 'choice', answersClose: 'wholeRound' }, seq, 9)).toEqual(
      []
    )
  })
})
