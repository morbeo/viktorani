// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyNav } from '@/hooks/useKeyNav'
import { useNavigation } from '@/hooks/useNavigation'
import type { Game } from '@/db'

describe('useKeyNav', () => {
  const onNext = vi.fn()
  const onPrev = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('binds arrow keys when enabled', () => {
    renderHook(() => useKeyNav({ onNext, onPrev, modalOpen: false, enabled: true }))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(onNext).toHaveBeenCalled()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    })
    expect(onPrev).toHaveBeenCalled()
  })

  it('ignores keys when not enabled', () => {
    renderHook(() => useKeyNav({ onNext, onPrev, modalOpen: false, enabled: false }))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(onNext).not.toHaveBeenCalled()
  })

  it('ignores keys when modal is open', () => {
    renderHook(() => useKeyNav({ onNext, onPrev, modalOpen: true, enabled: true }))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(onNext).not.toHaveBeenCalled()
  })

  it('ignores keys when focus is in an input', () => {
    renderHook(() => useKeyNav({ onNext, onPrev, modalOpen: false, enabled: true }))

    const input = document.createElement('input')
    document.body.appendChild(input)

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      Object.defineProperty(event, 'target', { value: input, configurable: true })
      window.dispatchEvent(event)
    })

    expect(onNext).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('ignores keys when focus is in a textarea', () => {
    renderHook(() => useKeyNav({ onNext, onPrev, modalOpen: false, enabled: true }))

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
      Object.defineProperty(event, 'target', { value: textarea, configurable: true })
      window.dispatchEvent(event)
    })

    expect(onPrev).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('removes event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() =>
      useKeyNav({ onNext, onPrev, modalOpen: false, enabled: true })
    )

    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})

const mockDb = {
  gameQuestions: { where: vi.fn() },
  rounds: { toArray: vi.fn() },
  games: { update: vi.fn() },
}

const mockTransportManager = {
  send: vi.fn(),
}

vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('@/transport', () => ({ transportManager: mockTransportManager }))

describe('useNavigation', () => {
  const game: Game = {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    roundIds: ['r1'],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    joinPolicy: 'open',
    allowLateJoin: true,
    scoringEnabled: true,
    buzzerLocked: false,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'first',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startedAt: Date.now(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.gameQuestions.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: 'gq1', gameId: 'g1', roundId: 'r1', questionId: 'q1', order: 0 },
          { id: 'gq2', gameId: 'g1', roundId: 'r1', questionId: 'q2', order: 1 },
        ]),
      }),
    })
    mockDb.rounds.toArray.mockResolvedValue([{ id: 'r1', name: 'Round 1' }])
    mockDb.games.update.mockResolvedValue(undefined)
  })

  it('loads navigation sequence on mount', async () => {
    const { result } = renderHook(() => useNavigation(game))

    await vi.waitFor(() => {
      expect(result.current.isReady).toBe(true)
    })

    expect(result.current.seq).toHaveLength(2)
    expect(result.current.pos).not.toBeNull()
  })

  it('returns isEmpty when game has no questions', async () => {
    mockDb.gameQuestions.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    })

    const { result } = renderHook(() => useNavigation(game))

    await vi.waitFor(() => {
      expect(result.current.isEmpty).toBe(true)
    })
  })

  it('navigates to next question', async () => {
    const { result } = renderHook(() => useNavigation(game))

    await vi.waitFor(() => {
      expect(result.current.isReady).toBe(true)
    })

    await act(async () => {
      await result.current.goNext()
    })

    expect(mockDb.games.update).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ currentQuestionIdx: 1 })
    )
    expect(mockTransportManager.send).toHaveBeenCalledWith({
      type: 'SLIDE_CHANGE',
      index: 1,
      roundIndex: 0,
    })
  })

  it('navigates to previous question', async () => {
    const gameAtQ2 = { ...game, currentQuestionIdx: 1 }
    const { result } = renderHook(() => useNavigation(gameAtQ2))

    await vi.waitFor(() => {
      expect(result.current.isReady).toBe(true)
    })

    await act(async () => {
      await result.current.goPrev()
    })

    expect(mockDb.games.update).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ currentQuestionIdx: 0 })
    )
    expect(mockTransportManager.send).toHaveBeenCalledWith({
      type: 'SLIDE_CHANGE',
      index: 0,
      roundIndex: 0,
    })
  })

  it('does not navigate past boundaries', async () => {
    const { result } = renderHook(() => useNavigation(game))

    await vi.waitFor(() => {
      expect(result.current.isReady).toBe(true)
    })

    await act(async () => {
      await result.current.goPrev()
    })

    expect(mockDb.games.update).not.toHaveBeenCalled()
  })

  it('calls onRoundBoundary when crossing rounds', async () => {
    mockDb.gameQuestions.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: 'gq1', gameId: 'g1', roundId: 'r1', questionId: 'q1', order: 0 },
          { id: 'gq2', gameId: 'g1', roundId: 'r2', questionId: 'q2', order: 1 },
        ]),
      }),
    })
    mockDb.rounds.toArray.mockResolvedValue([
      { id: 'r1', name: 'Round 1' },
      { id: 'r2', name: 'Round 2' },
    ])

    const onRoundBoundary = vi.fn()
    const { result } = renderHook(() => useNavigation({ ...game, roundIds: ['r1', 'r2'] }, onRoundBoundary))

    await vi.waitFor(() => {
      expect(result.current.isReady).toBe(true)
    })

    await act(async () => {
      await result.current.goNext()
    })

    expect(onRoundBoundary).toHaveBeenCalled()
  })
})
