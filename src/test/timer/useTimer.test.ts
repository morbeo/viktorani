// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { formatTime, useTimerList } from '@/hooks/useTimer'
import { db } from '@/db'

// ── Mock transport ────────────────────────────────────────────────────────────

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

import { transportManager } from '@/transport'

// ── formatTime ────────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats 0 as 00:00', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('formats 90 seconds as 01:30', () => {
    expect(formatTime(90)).toBe('01:30')
  })

  it('formats 3600 as 60:00', () => {
    expect(formatTime(3600)).toBe('60:00')
  })

  it('ceils fractional seconds', () => {
    expect(formatTime(59.1)).toBe('01:00')
  })
})

// ── useTimerList ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-timer-test'

// Helper: wait for the initial DB load effect to settle
async function flush() {
  await act(async () => {
    await new Promise(r => setTimeout(r, 0))
  })
}

describe('useTimerList', () => {
  beforeEach(async () => {
    // Clear any timers left from previous tests
    await db.timers.where('gameId').equals(GAME_ID).delete()
    vi.mocked(transportManager.send).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts empty', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()
    expect(result.current.timers).toHaveLength(0)
  })

  it('createTimer adds a timer to the list and DB', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    await act(async () => {
      await result.current.createTimer({ gameId: GAME_ID, label: 'Test', duration: 60 })
    })

    expect(result.current.timers).toHaveLength(1)
    expect(result.current.timers[0].label).toBe('Test')
    expect(result.current.timers[0].duration).toBe(60)
    expect(result.current.timers[0].paused).toBe(true)

    const dbRecord = await db.timers.where('gameId').equals(GAME_ID).first()
    expect(dbRecord).toBeTruthy()
  })

  it('startTimer emits TIMER_START and marks timer running', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    let timerId!: string
    await act(async () => {
      const t = await result.current.createTimer({ gameId: GAME_ID, label: 'Go', duration: 30 })
      timerId = t.id
    })

    await act(async () => {
      await result.current.startTimer(timerId)
    })

    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TIMER_START', id: timerId, duration: 30, label: 'Go' })
    )
    const t = result.current.timers.find(x => x.id === timerId)
    expect(t?.paused).toBe(false)
    expect(t?.startedAt).not.toBeNull()
  })

  it('pauseTimer emits TIMER_PAUSE and snapshots remaining', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    let timerId!: string
    await act(async () => {
      const t = await result.current.createTimer({ gameId: GAME_ID, label: 'P', duration: 60 })
      timerId = t.id
    })

    // Spy on Date.now to control elapsed time without fake timers (which break Dexie).
    // Set t0 before startTimer so startedAt === t0.
    const t0 = 1_000_000
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(t0)

    await act(async () => {
      await result.current.startTimer(timerId)
    })

    // Let timersRef sync with the updated React state before pauseTimer reads it
    await flush()

    // Simulate 10 seconds passing then pause
    dateSpy.mockReturnValue(t0 + 10_000)

    await act(async () => {
      await result.current.pauseTimer(timerId)
    })

    const t = result.current.timers.find(x => x.id === timerId)
    expect(t?.paused).toBe(true)
    expect(t?.remaining).toBeCloseTo(50, 0)
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TIMER_PAUSE', id: timerId })
    )
  })

  it('resumeTimer emits TIMER_RESUME and marks running', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    let timerId!: string
    await act(async () => {
      const t = await result.current.createTimer({ gameId: GAME_ID, label: 'R', duration: 60 })
      timerId = t.id
      await result.current.startTimer(timerId)
      await result.current.pauseTimer(timerId)
    })

    await act(async () => {
      await result.current.resumeTimer(timerId)
    })

    const t = result.current.timers.find(x => x.id === timerId)
    expect(t?.paused).toBe(false)
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TIMER_RESUME', id: timerId })
    )
  })

  it('deleteTimer removes from list and DB', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    let timerId!: string
    await act(async () => {
      const t = await result.current.createTimer({ gameId: GAME_ID, label: 'Del', duration: 10 })
      timerId = t.id
    })

    await act(async () => {
      await result.current.deleteTimer(timerId)
    })

    expect(result.current.timers.find(x => x.id === timerId)).toBeUndefined()
    const dbRecord = await db.timers.get(timerId)
    expect(dbRecord).toBeUndefined()
  })

  it('remaining returns full duration for a paused-never-started timer', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    let timerId!: string
    await act(async () => {
      const t = await result.current.createTimer({ gameId: GAME_ID, label: 'Idle', duration: 45 })
      timerId = t.id
    })

    expect(result.current.remaining(timerId)).toBe(45)
  })

  it('resumeAll resumes all paused timers', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    let idA!: string
    let idB!: string
    await act(async () => {
      const a = await result.current.createTimer({ gameId: GAME_ID, label: 'A', duration: 30 })
      const b = await result.current.createTimer({ gameId: GAME_ID, label: 'B', duration: 30 })
      idA = a.id
      idB = b.id
      await result.current.startTimer(idA)
      await result.current.startTimer(idB)
    })

    await flush()

    await act(async () => {
      await result.current.pauseAll()
    })

    expect(result.current.timers.every(t => t.paused)).toBe(true)

    await flush()

    await act(async () => {
      await result.current.resumeAll()
    })

    expect(result.current.timers.find(t => t.id === idA)?.paused).toBe(false)
    expect(result.current.timers.find(t => t.id === idB)?.paused).toBe(false)
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TIMER_RESUME', id: idA })
    )
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TIMER_RESUME', id: idB })
    )
  })

  it('deleteAll clears all timers', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    await act(async () => {
      await result.current.createTimer({ gameId: GAME_ID, label: 'A', duration: 10 })
      await result.current.createTimer({ gameId: GAME_ID, label: 'B', duration: 20 })
    })

    expect(result.current.timers).toHaveLength(2)

    await act(async () => {
      await result.current.deleteAll()
    })

    expect(result.current.timers).toHaveLength(0)
  })

  it('hydrates from DB on mount (simulates page reload)', async () => {
    await db.timers.add({
      id: 'hydrate-test',
      gameId: GAME_ID,
      label: 'Hydrated',
      duration: 30,
      remaining: 15,
      target: 'all',
      message: '',
      visible: true,
      paused: true,
      startedAt: null,
      audioNotify: 'none',
      visualNotify: 'none',
      autoReset: 'none',
    })

    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    expect(result.current.timers.find(t => t.id === 'hydrate-test')).toBeTruthy()
    await db.timers.delete('hydrate-test')
  })
})
