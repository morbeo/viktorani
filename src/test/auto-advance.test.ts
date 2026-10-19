import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAutoAdvance } from '@/hooks/useAutoAdvance'
import type { UseAutoAdvanceOptions } from '@/hooks/useAutoAdvance'
import type { Timer } from '@/db'

const NOW = 1_000_000

function makeTimer(overrides: Partial<Timer> = {}): Timer {
  return {
    id: 't1',
    gameId: 'g1',
    label: 'Question',
    duration: 10,
    remaining: 10,
    target: 'all',
    message: '',
    visible: true,
    paused: false,
    startedAt: NOW,
    audioNotify: 'none',
    visualNotify: 'none',
    autoReset: 'question',
    ...overrides,
  }
}

function setup(overrides: Partial<UseAutoAdvanceOptions> = {}, game = {}) {
  const onAdvance = vi.fn()
  const initial: UseAutoAdvanceOptions = {
    game: {
      status: 'active',
      autoAdvanceOnCorrect: true,
      autoAdvanceOnTimerExpiry: true,
      autoAdvanceDelaySeconds: 3,
      ...game,
    },
    flatIndex: 0,
    isLast: false,
    timers: [],
    onAdvance,
    ...overrides,
  }
  const hook = renderHook((props: UseAutoAdvanceOptions) => useAutoAdvance(props), {
    initialProps: initial,
  })
  return { ...hook, onAdvance, initial }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutoAdvance: after a correct ruling', () => {
  it('counts down and then advances', () => {
    const { result, onAdvance } = setup()

    act(() => result.current.onCorrect())
    expect(result.current.pending).toMatchObject({ reason: 'correct', secondsLeft: 3 })

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.pending?.secondsLeft).toBe(2)
    expect(onAdvance).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(2000))
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the setting is off', () => {
    const { result, onAdvance } = setup({}, { autoAdvanceOnCorrect: false })

    act(() => result.current.onCorrect())
    act(() => vi.advanceTimersByTime(5000))

    expect(result.current.pending).toBeNull()
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('stays when the host cancels', () => {
    const { result, onAdvance } = setup()

    act(() => result.current.onCorrect())
    act(() => result.current.cancel())
    act(() => vi.advanceTimersByTime(5000))

    expect(result.current.pending).toBeNull()
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('drops the countdown when the host navigates first', () => {
    const { result, rerender, onAdvance, initial } = setup()

    act(() => result.current.onCorrect())
    rerender({ ...initial, flatIndex: 1 })
    act(() => vi.advanceTimersByTime(5000))

    expect(result.current.pending).toBeNull()
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it.each([
    ['the game is paused', { game: { status: 'paused' } }],
    ['it is the last question', { isLast: true }],
  ] as const)('never advances when %s', (_, change) => {
    const { result, rerender, onAdvance, initial } = setup()

    act(() => result.current.onCorrect())
    rerender({
      ...initial,
      ...('isLast' in change ? change : {}),
      game: { ...initial.game, ...('game' in change ? change.game : {}) },
    })
    act(() => vi.advanceTimersByTime(5000))

    expect(result.current.pending).toBeNull()
    expect(onAdvance).not.toHaveBeenCalled()
  })
})

describe('useAutoAdvance: when the question timer runs out', () => {
  it('shows the countdown only after the timer reaches zero, then advances', () => {
    const { result, onAdvance } = setup({ timers: [makeTimer()] })
    expect(result.current.pending).toBeNull()

    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current.pending).toMatchObject({ reason: 'timer', secondsLeft: 3 })

    act(() => vi.advanceTimersByTime(3000))
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('ignores timers that are not question timers, and paused ones', () => {
    const { onAdvance } = setup({
      timers: [
        makeTimer({ id: 'round', autoReset: 'round' }),
        makeTimer({ id: 'game', autoReset: 'none' }),
        makeTimer({ id: 'paused', paused: true, startedAt: null }),
      ],
    })

    act(() => vi.advanceTimersByTime(20_000))

    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('ignores a timer that ran out before the page opened', () => {
    const { onAdvance } = setup({ timers: [makeTimer({ startedAt: NOW - 60_000 })] })

    act(() => vi.advanceTimersByTime(20_000))

    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('does nothing when the setting is off', () => {
    const { onAdvance } = setup({ timers: [makeTimer()] }, { autoAdvanceOnTimerExpiry: false })

    act(() => vi.advanceTimersByTime(20_000))

    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('stays when the host cancels', () => {
    const { result, onAdvance } = setup({ timers: [makeTimer()] })

    act(() => vi.advanceTimersByTime(10_000))
    act(() => result.current.cancel())
    act(() => vi.advanceTimersByTime(5000))

    expect(result.current.pending).toBeNull()
    expect(onAdvance).not.toHaveBeenCalled()
  })
})
