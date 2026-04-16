// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Game, Player } from '@/db'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSend = vi.fn()
const mockDisconnect = vi.fn()

vi.mock('@/transport', () => ({
  transportManager: {
    send: (...args: unknown[]) => mockSend(...args),
    disconnect: () => mockDisconnect(),
  },
}))

vi.mock('@/db', () => {
  const games = new Map<string, Game>()
  return {
    db: {
      games: {
        update: vi.fn(async (id: string, patch: Partial<Game>) => {
          const existing = games.get(id)
          if (existing) games.set(id, { ...existing, ...patch })
          return 1
        }),
        _store: games,
      },
    },
  }
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Quiz Night',
    status: 'active',
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
    roundIds: ['r1'],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly' as const,
    tiebreakerMode: 'serverOrder' as const,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    score: 10,
    isAway: false,
    deviceId: 'dev-1',
    joinedAt: 1000,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// We test the pure logic of each action directly by importing the hook and
// calling it outside React. The hook returns stable callbacks (useCallback
// with no closing-over state) so this is safe.
import { renderHook } from '@testing-library/react'
import { useGameLifecycle } from '@/hooks/useGameLifecycle'

beforeEach(() => {
  mockSend.mockClear()
  mockDisconnect.mockClear()
})

describe('useGameLifecycle — pauseGame', () => {
  it('returns a game with status="paused"', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    const game = makeGame({ status: 'active' })
    const updated = await result.current.pauseGame(game)
    expect(updated.status).toBe('paused')
  })

  it('emits GAME_STATUS { status: "paused" }', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    await result.current.pauseGame(makeGame())
    expect(mockSend).toHaveBeenCalledWith({ type: 'GAME_STATUS', status: 'paused' })
  })

  it('updates updatedAt to a recent timestamp', async () => {
    const before = Date.now()
    const { result } = renderHook(() => useGameLifecycle())
    const updated = await result.current.pauseGame(makeGame())
    expect(updated.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('does not disconnect transport', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    await result.current.pauseGame(makeGame())
    expect(mockDisconnect).not.toHaveBeenCalled()
  })
})

describe('useGameLifecycle — resumeGame', () => {
  it('returns a game with status="active"', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    const game = makeGame({ status: 'paused' })
    const updated = await result.current.resumeGame(game)
    expect(updated.status).toBe('active')
  })

  it('emits GAME_STATUS { status: "active" }', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    await result.current.resumeGame(makeGame({ status: 'paused' }))
    expect(mockSend).toHaveBeenCalledWith({ type: 'GAME_STATUS', status: 'active' })
  })

  it('does not disconnect transport', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    await result.current.resumeGame(makeGame({ status: 'paused' }))
    expect(mockDisconnect).not.toHaveBeenCalled()
  })
})

describe('useGameLifecycle — endGame', () => {
  it('returns a game with status="ended"', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    const updated = await result.current.endGame(makeGame(), [])
    expect(updated.status).toBe('ended')
  })

  it('emits GAME_STATUS { status: "ended" }', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    await result.current.endGame(makeGame(), [])
    expect(mockSend).toHaveBeenCalledWith({ type: 'GAME_STATUS', status: 'ended' })
  })

  it('emits GAME_STATE snapshot before disconnecting', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    const players = [makePlayer({ score: 42 })]
    await result.current.endGame(makeGame(), players)

    const stateCall = mockSend.mock.calls.find(
      ([e]: [{ type: string }]) => e.type === 'GAME_STATE'
    )
    expect(stateCall).toBeDefined()
    expect(stateCall![0].state.status).toBe('ended')
    expect(stateCall![0].state.scores['p1']).toBe(42)
  })

  it('disconnects transport after emitting', async () => {
    const { result } = renderHook(() => useGameLifecycle())
    await result.current.endGame(makeGame(), [])
    expect(mockDisconnect).toHaveBeenCalledOnce()
  })

  it('GAME_STATE is sent before disconnect', async () => {
    const callOrder: string[] = []
    mockSend.mockImplementation((e: { type: string }) => callOrder.push(e.type))
    mockDisconnect.mockImplementation(() => callOrder.push('disconnect'))

    const { result } = renderHook(() => useGameLifecycle())
    await result.current.endGame(makeGame(), [])

    const stateIdx = callOrder.indexOf('GAME_STATE')
    const disconnectIdx = callOrder.indexOf('disconnect')
    expect(stateIdx).toBeLessThan(disconnectIdx)
  })
})
