// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameVisibility } from '@/hooks/useGameVisibility'
import type { Game } from '@/db'

vi.mock('@/db', () => ({ db: { games: { update: vi.fn() } } }))
vi.mock('@/transport', () => ({ transportManager: { send: vi.fn() } }))

import { db } from '@/db'
import { transportManager } from '@/transport'

const BASE_GAME: Game = {
  id: 'g1',
  name: 'Test',
  status: 'active',
  transportMode: 'auto',
  roomId: 'ABC',
  passphrase: 'a-b-c-d',
  scoringEnabled: true,
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
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly' as const,
  tiebreakerMode: 'serverOrder' as const,
  createdAt: 0,
  updatedAt: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.games.update).mockResolvedValue(1)
})

// These tests extend src/test/host/useGameVisibility.test.ts which already covers the
// happy-path and Error-instance rollback. Here we cover the remaining branch:
// the `else` arm of `err instanceof Error` in the catch block (line 51 in the
// coverage report) — thrown value is not an Error object.

describe('useGameVisibility — rollback on non-Error rejection', () => {
  beforeEach(() => {
    // Throw a plain string, not an Error instance — exercises the else branch
    vi.mocked(db.games.update).mockRejectedValue('plain string rejection')
  })

  it('rolls back optimistic update when rejection is not an Error', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(result.current.visibility.showAnswers).toBe(false)
  })

  it('sets the fallback error message', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(result.current.error).toBe('Failed to save visibility')
  })

  it('does not emit a transport event', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(transportManager.send).not.toHaveBeenCalled()
  })

  it('resets saving to false', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(result.current.saving).toBe(false)
  })
})
