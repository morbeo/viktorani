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
  createdAt: 0,
  updatedAt: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.games.update).mockResolvedValue(1)
})

describe('useGameVisibility — initial state', () => {
  it('initialises from game record', () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    expect(result.current.visibility).toEqual({
      showQuestion: true,
      showAnswers: false,
      showMedia: true,
    })
  })
  it('starts with saving=false and error=null', () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    expect(result.current.saving).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('useGameVisibility — toggle', () => {
  it('flips the targeted key', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(result.current.visibility.showAnswers).toBe(true)
  })
  it('does not change other keys', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(result.current.visibility.showQuestion).toBe(true)
    expect(result.current.visibility.showMedia).toBe(true)
  })
  it('persists full state to db.games.update', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(db.games.update).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({
        showQuestion: true,
        showAnswers: true,
        showMedia: true,
      })
    )
  })
  it('emits VISIBILITY event via transportManager', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showMedia')
    })
    expect(transportManager.send).toHaveBeenCalledWith({
      type: 'VISIBILITY',
      showQuestion: true,
      showAnswers: false,
      showMedia: false,
    })
  })
  it('resets saving to false after success', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(result.current.saving).toBe(false)
  })
})

describe('useGameVisibility — rollback on error', () => {
  beforeEach(() => {
    vi.mocked(db.games.update).mockRejectedValue(new Error('DB write failed'))
  })
  it('rolls back optimistic update', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(result.current.visibility.showAnswers).toBe(false)
  })
  it('sets error message', async () => {
    const { result } = renderHook(() => useGameVisibility(BASE_GAME))
    await act(async () => {
      await result.current.toggle('showAnswers')
    })
    expect(result.current.error).toBe('DB write failed')
  })
  it('does not emit event', async () => {
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
