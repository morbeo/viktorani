// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

import { db } from '@/db'
import { transportManager } from '@/transport'
import { useGameVisibility } from '@/hooks/useGameVisibility'
import type { Game } from '@/db'

const mockSend = transportManager.send as MockedFunction<typeof transportManager.send>

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await db.games.clear()
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

// ── useGameVisibility ─────────────────────────────────────────────────────────

describe('useGameVisibility', () => {
  beforeEach(async () => {
    await clearAll()
    mockSend.mockClear()
  })

  it('initialises visibility from the game record', () => {
    const game = makeGame({ showQuestion: false, showAnswers: true, showMedia: false })
    const { result } = renderHook(() => useGameVisibility(game))
    expect(result.current.visibility).toEqual({
      showQuestion: false,
      showAnswers: true,
      showMedia: false,
    })
  })

  it('toggles showQuestion from true to false', async () => {
    const game = makeGame({ showQuestion: true })
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('showQuestion')
    })

    expect(result.current.visibility.showQuestion).toBe(false)
  })

  it('toggles showAnswers from false to true', async () => {
    const game = makeGame({ showAnswers: false })
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })

    expect(result.current.visibility.showAnswers).toBe(true)
  })

  it('persists the updated flags to the DB', async () => {
    const game = makeGame({ showQuestion: true, showAnswers: false, showMedia: true })
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })

    const stored = await db.games.get('g1')
    expect(stored?.showAnswers).toBe(true)
    expect(stored?.showQuestion).toBe(true) // unchanged
    expect(stored?.showMedia).toBe(true) // unchanged
  })

  it('emits a VISIBILITY event with the updated flags', async () => {
    const game = makeGame({ showQuestion: true, showAnswers: false, showMedia: true })
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('showMedia')
    })

    expect(mockSend).toHaveBeenCalledWith({
      type: 'VISIBILITY',
      showQuestion: true,
      showAnswers: false,
      showMedia: false,
    })
  })

  it('only emits one VISIBILITY event per toggle call', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('showQuestion')
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('sets saving to false after a successful toggle', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('showQuestion')
    })

    expect(result.current.saving).toBe(false)
  })

  it('leaves error as null after a successful toggle', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('showQuestion')
    })

    expect(result.current.error).toBeNull()
  })
})
