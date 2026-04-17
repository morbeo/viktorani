// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

import { db } from '@/db'
import { transportManager } from '@/transport'
import { transitionQuestionStatus } from '@/pages/admin/gamemaster-utils'
import type { GameQuestion } from '@/db'

const mockSend = transportManager.send as MockedFunction<typeof transportManager.send>

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await db.gameQuestions.clear()
}

function makeGQ(overrides: Partial<GameQuestion> = {}): GameQuestion {
  return {
    id: 'gq1',
    gameId: 'g1',
    questionId: 'q1',
    roundId: 'r1',
    order: 0,
    status: 'pending',
    ...overrides,
  }
}

// ── transitionQuestionStatus — pure function ──────────────────────────────────

describe('transitionQuestionStatus — valid transitions', () => {
  it('allows pending -> correct', () => {
    expect(transitionQuestionStatus('pending', 'correct')).toBe('correct')
  })

  it('allows pending -> incorrect', () => {
    expect(transitionQuestionStatus('pending', 'incorrect')).toBe('incorrect')
  })

  it('allows pending -> skipped', () => {
    expect(transitionQuestionStatus('pending', 'skipped')).toBe('skipped')
  })
})

describe('transitionQuestionStatus — invalid transitions', () => {
  it('throws when transitioning correct -> pending', () => {
    expect(() => transitionQuestionStatus('correct', 'pending')).toThrow(
      'invalid transition: correct -> pending'
    )
  })

  it('throws when transitioning correct -> incorrect', () => {
    expect(() => transitionQuestionStatus('correct', 'incorrect')).toThrow(
      'invalid transition: correct -> incorrect'
    )
  })

  it('throws when transitioning correct -> skipped', () => {
    expect(() => transitionQuestionStatus('correct', 'skipped')).toThrow(
      'invalid transition: correct -> skipped'
    )
  })

  it('throws when transitioning incorrect -> pending', () => {
    expect(() => transitionQuestionStatus('incorrect', 'pending')).toThrow(
      'invalid transition: incorrect -> pending'
    )
  })

  it('throws when transitioning incorrect -> correct', () => {
    expect(() => transitionQuestionStatus('incorrect', 'correct')).toThrow(
      'invalid transition: incorrect -> correct'
    )
  })

  it('throws when transitioning skipped -> correct', () => {
    expect(() => transitionQuestionStatus('skipped', 'correct')).toThrow(
      'invalid transition: skipped -> correct'
    )
  })

  it('throws when transitioning skipped -> pending', () => {
    expect(() => transitionQuestionStatus('skipped', 'pending')).toThrow(
      'invalid transition: skipped -> pending'
    )
  })
})

// ── DB persistence of status transitions ─────────────────────────────────────

describe('GameQuestion status DB persistence', () => {
  beforeEach(async () => {
    await clearAll()
    mockSend.mockClear()
  })

  it('persists pending -> correct to the DB', async () => {
    const gq = makeGQ({ status: 'pending' })
    await db.gameQuestions.add(gq)

    const nextStatus = transitionQuestionStatus('pending', 'correct')
    await db.gameQuestions.update('gq1', { status: nextStatus })

    const stored = await db.gameQuestions.get('gq1')
    expect(stored?.status).toBe('correct')
  })

  it('persists pending -> incorrect to the DB', async () => {
    const gq = makeGQ({ status: 'pending' })
    await db.gameQuestions.add(gq)

    const nextStatus = transitionQuestionStatus('pending', 'incorrect')
    await db.gameQuestions.update('gq1', { status: nextStatus })

    const stored = await db.gameQuestions.get('gq1')
    expect(stored?.status).toBe('incorrect')
  })

  it('persists pending -> skipped to the DB', async () => {
    const gq = makeGQ({ status: 'pending' })
    await db.gameQuestions.add(gq)

    const nextStatus = transitionQuestionStatus('pending', 'skipped')
    await db.gameQuestions.update('gq1', { status: nextStatus })

    const stored = await db.gameQuestions.get('gq1')
    expect(stored?.status).toBe('skipped')
  })

  it('does not persist the status when the transition is invalid', async () => {
    const gq = makeGQ({ status: 'correct' })
    await db.gameQuestions.add(gq)

    let threw = false
    try {
      const nextStatus = transitionQuestionStatus('correct', 'pending')
      await db.gameQuestions.update('gq1', { status: nextStatus })
    } catch {
      threw = true
    }

    expect(threw).toBe(true)
    const stored = await db.gameQuestions.get('gq1')
    expect(stored?.status).toBe('correct') // unchanged
  })
})
