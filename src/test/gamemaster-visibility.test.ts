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
    roomId: 'ROOM1',
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    maxTeams: 0,
    maxPerTeam: 0,
    maxPlayers: 0,
    allowIndividual: true,
    allowLateJoin: true,
    allowRejoin: true,
    requireApproval: false,
    allowPlayerTeams: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    scoringEnabled: true,
    buzzerEnabled: true,
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
    const visibility = {
      players: { showQuestion: false, showAnswers: true, showMedia: false },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    }
    const { result } = renderHook(() => useGameVisibility(makeGame({ visibility })))
    expect(result.current.visibility).toEqual(visibility)
  })

  it('toggles a flag on one target only', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('players', 'showQuestion')
    })

    expect(result.current.visibility.players.showQuestion).toBe(false)
    expect(result.current.visibility.screen.showQuestion).toBe(true)
  })

  it('reports the saved patch so the caller can update its game', async () => {
    const game = makeGame()
    await db.games.add(game)
    const onGameChange = vi.fn()

    const { result } = renderHook(() => useGameVisibility(game, onGameChange))
    await act(async () => {
      await result.current.toggle('players', 'showMedia')
    })

    expect(onGameChange).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: expect.objectContaining({
          players: { showQuestion: true, showAnswers: false, showMedia: false },
        }),
      })
    )
  })

  it('toggles the screen independently of players', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('screen', 'showAnswers')
    })

    expect(result.current.visibility.screen.showAnswers).toBe(true)
    expect(result.current.visibility.players.showAnswers).toBe(false)
  })

  it('persists both targets to the DB', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('players', 'showAnswers')
    })

    const stored = await db.games.get('g1')
    expect(stored?.visibility).toEqual({
      players: { showQuestion: true, showAnswers: true, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    })
  })

  it.each(['players', 'screen'] as const)(
    'emits a VISIBILITY event for the %s target',
    async target => {
      const game = makeGame()
      await db.games.add(game)

      const { result } = renderHook(() => useGameVisibility(game))
      await act(async () => {
        await result.current.toggle(target, 'showMedia')
      })

      expect(mockSend).toHaveBeenCalledWith({
        type: 'VISIBILITY',
        target,
        showQuestion: true,
        showAnswers: false,
        showMedia: false,
      })
    }
  )

  it('only emits one VISIBILITY event per toggle call', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('players', 'showQuestion')
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('sets saving to false after a successful toggle', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('players', 'showQuestion')
    })

    expect(result.current.saving).toBe(false)
  })

  it('leaves error as null after a successful toggle', async () => {
    const game = makeGame()
    await db.games.add(game)

    const { result } = renderHook(() => useGameVisibility(game))
    await act(async () => {
      await result.current.toggle('players', 'showQuestion')
    })

    expect(result.current.error).toBeNull()
  })
})
