// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, screen, fireEvent, within } from '@testing-library/react'
import {
  useTimerList,
  useTimerExpiry,
  applyAutoReset,
  playBeep,
  runningTimerEvents,
} from '@/hooks/useTimer'
import { EditTimerModal } from '@/components/timer/EditTimerModal'
import { db } from '@/db'
import type { Timer } from '@/db'

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

import { transportManager } from '@/transport'

// ── Helpers ───────────────────────────────────────────────────────────────────

const GAME_ID = 'game-expiry-test'

async function flush() {
  await act(async () => {
    await new Promise(r => setTimeout(r, 0))
  })
}

function makeTimer(overrides: Partial<Timer> = {}): Timer {
  return {
    id: crypto.randomUUID(),
    gameId: GAME_ID,
    label: 'Test',
    duration: 60,
    remaining: 60,
    target: 'all',
    message: '',
    visible: true,
    paused: true,
    startedAt: null,
    audioNotify: 'none',
    visualNotify: 'none',
    autoReset: 'none',
    ...overrides,
  }
}

// ── updateTimer ───────────────────────────────────────────────────────────────

describe('updateTimer', () => {
  beforeEach(async () => {
    await db.timers.where('gameId').equals(GAME_ID).delete()
    vi.mocked(transportManager.send).mockClear()
  })

  it('persists audioNotify, visualNotify, autoReset to DB', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    let timerId!: string
    await act(async () => {
      const t = await result.current.createTimer({ gameId: GAME_ID, label: 'U', duration: 30 })
      timerId = t.id
    })

    await act(async () => {
      await result.current.updateTimer(timerId, {
        audioNotify: 'both',
        visualNotify: 'host',
        autoReset: 'question',
      })
    })

    const t = result.current.timers.find(x => x.id === timerId)
    expect(t?.audioNotify).toBe('both')
    expect(t?.visualNotify).toBe('host')
    expect(t?.autoReset).toBe('question')

    const dbRecord = await db.timers.get(timerId)
    expect(dbRecord?.audioNotify).toBe('both')
    expect(dbRecord?.visualNotify).toBe('host')
    expect(dbRecord?.autoReset).toBe('question')
  })

  it('updates label', async () => {
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    let timerId!: string
    await act(async () => {
      const t = await result.current.createTimer({ gameId: GAME_ID, label: 'Old', duration: 10 })
      timerId = t.id
    })
    await act(async () => {
      await result.current.updateTimer(timerId, { label: 'New' })
    })

    expect(result.current.timers.find(x => x.id === timerId)?.label).toBe('New')
  })
})

// ── useTimerExpiry ────────────────────────────────────────────────────────────

describe('useTimerExpiry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls onExpire when remaining hits 0', () => {
    const onExpire = vi.fn()
    const timer = makeTimer({ paused: false, startedAt: Date.now() - 65_000 })
    // remaining will be ~0 for a 60s timer started 65s ago
    const remaining = vi.fn().mockReturnValue(0)

    renderHook(() => useTimerExpiry([timer], remaining, onExpire))
    expect(onExpire).toHaveBeenCalledOnce()
    expect(onExpire).toHaveBeenCalledWith(
      expect.objectContaining({ id: timer.id, label: timer.label })
    )
  })

  it('does not fire for paused timers', () => {
    const onExpire = vi.fn()
    const timer = makeTimer({ paused: true, remaining: 0 })
    const remaining = vi.fn().mockReturnValue(0)
    renderHook(() => useTimerExpiry([timer], remaining, onExpire))
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('fires only once per run (same startedAt)', () => {
    const onExpire = vi.fn()
    const timer = makeTimer({ paused: false, startedAt: 12345 })
    const remaining = vi.fn().mockReturnValue(0)
    const { rerender } = renderHook(() => useTimerExpiry([timer], remaining, onExpire))
    rerender()
    rerender()
    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('fires again after restart (different startedAt)', () => {
    const onExpire = vi.fn()
    let startedAt = 10000
    const remaining = vi.fn().mockReturnValue(0)

    const { rerender } = renderHook(
      ({ sat }: { sat: number }) => {
        const timer = makeTimer({ paused: false, startedAt: sat })
        useTimerExpiry([timer], remaining, onExpire)
      },
      { initialProps: { sat: startedAt } }
    )

    expect(onExpire).toHaveBeenCalledTimes(1)
    startedAt = 20000
    rerender({ sat: startedAt })
    expect(onExpire).toHaveBeenCalledTimes(2)
  })

  it('fires on second natural expiry after restart (bug #84 regression)', () => {
    // Regression: after expiry, firedRef held id:startedAt. On restart,
    // a brief render could run the hook while timersRef was stale (remaining≈0,
    // new startedAt), adding the new runKey to firedRef before the timer
    // actually ran. The second natural expiry then found the key and silently
    // skipped. Fix: compute remaining directly from t.startedAt/t.remaining
    // and evict the runKey when the timer is actively running (rem > 0).
    const onExpire = vi.fn()

    // Run 1: timer started at T1, expires
    const T1 = Date.now() - 65_000 // 65s ago → expired
    const timer1 = makeTimer({ paused: false, startedAt: T1, remaining: 60 })
    const { rerender } = renderHook(
      ({ timer }: { timer: ReturnType<typeof makeTimer> }) => {
        useTimerExpiry([timer], vi.fn(), onExpire)
      },
      { initialProps: { timer: timer1 } }
    )
    expect(onExpire).toHaveBeenCalledTimes(1)

    // Simulate restart: timer is now running with a fresh startedAt and full remaining
    // (this is what restartTimer produces — remaining = duration, startedAt = now)
    const T2 = Date.now() // just started
    const timerRunning = makeTimer({ paused: false, startedAt: T2, remaining: 60 })
    rerender({ timer: timerRunning })
    // Should NOT fire — timer is actively running (rem ≈ 60 > 0)
    expect(onExpire).toHaveBeenCalledTimes(1)

    // Now the timer expires naturally on its second run
    const T2_expired = T2 - 65_000 // pretend it started 65s ago
    const timer2 = makeTimer({ paused: false, startedAt: T2_expired, remaining: 60 })
    rerender({ timer: timer2 })
    // Must fire — this is the bug: previously the key id:T2 was already in firedRef
    expect(onExpire).toHaveBeenCalledTimes(2)
  })

  it('calls playBeep when audioNotify includes host', () => {
    const beepSpy = vi.spyOn({ playBeep }, 'playBeep').mockImplementation(() => {})
    // We can't easily spy on the module export in the same file,
    // so verify via AudioContext mock instead
    const mockStart = vi.fn()
    const mockStop = vi.fn()
    const mockConnect = vi.fn()
    const mockClose = vi.fn().mockResolvedValue(undefined)
    const MockAudioContext = vi.fn().mockImplementation(() => ({
      createOscillator: () => ({
        connect: mockConnect,
        start: mockStart,
        stop: mockStop,
        frequency: { value: 0 },
        type: '',
        onended: null,
      }),
      createGain: () => ({
        connect: mockConnect,
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
      }),
      destination: {},
      currentTime: 0,
      close: mockClose,
    }))
    vi.stubGlobal('AudioContext', MockAudioContext)

    const onExpire = vi.fn()
    const timer = makeTimer({ paused: false, startedAt: 99999, audioNotify: 'host' })
    const remaining = vi.fn().mockReturnValue(0)
    renderHook(() => useTimerExpiry([timer], remaining, onExpire))

    expect(MockAudioContext).toHaveBeenCalled()
    vi.unstubAllGlobals()
    beepSpy.mockRestore()
  })

  it('emits TIMER_EXPIRED with the notifications meant for players', () => {
    const onExpire = vi.fn()
    const timer = makeTimer({
      paused: false,
      startedAt: 55555,
      label: 'Finals',
      audioNotify: 'both',
      visualNotify: 'host',
    })
    const remaining = vi.fn().mockReturnValue(0)
    renderHook(() => useTimerExpiry([timer], remaining, onExpire))
    expect(transportManager.send).toHaveBeenCalledWith({
      type: 'TIMER_EXPIRED',
      id: timer.id,
      label: 'Finals',
      audio: true,
      visual: false,
    })
  })

  it('sends no TIMER_EXPIRED when no notification is meant for players', () => {
    vi.mocked(transportManager.send).mockClear()
    const timer = makeTimer({ paused: false, startedAt: 44444, visualNotify: 'host' })
    renderHook(() => useTimerExpiry([timer], vi.fn().mockReturnValue(0), vi.fn()))
    expect(transportManager.send).not.toHaveBeenCalled()
  })
})

// ── runningTimerEvents ────────────────────────────────────────────────────────

describe('runningTimerEvents', () => {
  it('sends only running timers, with the time they have left', () => {
    const now = 1_000_000
    const running = makeTimer({ label: 'Run', paused: false, startedAt: now - 20_000 })
    const paused = makeTimer({ paused: true, remaining: 30 })
    const expired = makeTimer({ paused: false, startedAt: now - 90_000 })
    expect(runningTimerEvents([running, paused, expired], now)).toEqual([
      { type: 'TIMER_START', id: running.id, duration: 60, label: 'Run', remaining: 40 },
    ])
  })
})

// ── applyAutoReset ────────────────────────────────────────────────────────────

describe('applyAutoReset', () => {
  beforeEach(async () => {
    await db.timers.where('gameId').equals(GAME_ID).delete()
    vi.mocked(transportManager.send).mockClear()
  })

  it('resets timer with autoReset=question on question change', async () => {
    const t = makeTimer({
      autoReset: 'question',
      paused: false,
      startedAt: Date.now(),
      remaining: 30,
    })
    await db.timers.add(t)
    await applyAutoReset([t], 'question')
    const updated = await db.timers.get(t.id)
    expect(updated?.paused).toBe(true)
    expect(updated?.remaining).toBe(t.duration)
    expect(updated?.startedAt).toBeNull()
    await db.timers.delete(t.id)
  })

  it('does not reset timer with autoReset=round on question change', async () => {
    const t = makeTimer({ autoReset: 'round', paused: false, startedAt: Date.now(), remaining: 30 })
    await db.timers.add(t)
    await applyAutoReset([t], 'question')
    const updated = await db.timers.get(t.id)
    expect(updated?.paused).toBe(false)
    await db.timers.delete(t.id)
  })

  it('resets timer with autoReset=any on any change', async () => {
    const t = makeTimer({ autoReset: 'any', paused: false, startedAt: Date.now(), remaining: 30 })
    await db.timers.add(t)
    await applyAutoReset([t], 'round')
    const updated = await db.timers.get(t.id)
    expect(updated?.paused).toBe(true)
    await db.timers.delete(t.id)
  })

  it('skips timers already at rest (paused, startedAt null)', async () => {
    const t = makeTimer({ autoReset: 'any', paused: true, startedAt: null, remaining: 60 })
    await db.timers.add(t)
    await applyAutoReset([t], 'question')
    expect(transportManager.send).not.toHaveBeenCalled()
    await db.timers.delete(t.id)
  })

  it('emits TIMER_RESET with the full duration for reset timers (#285)', async () => {
    const t = makeTimer({
      autoReset: 'question',
      paused: false,
      startedAt: Date.now(),
      remaining: 20,
    })
    await db.timers.add(t)
    await applyAutoReset([t], 'question')
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TIMER_RESET', id: t.id, duration: t.duration })
    )
    await db.timers.delete(t.id)
  })
})

// ── useTimerList.autoReset ────────────────────────────────────────────────────

describe('useTimerList.autoReset', () => {
  beforeEach(async () => {
    await db.timers.where('gameId').equals(GAME_ID).delete()
    vi.mocked(transportManager.send).mockClear()
  })

  it('shows full duration in local state and DB after a question change (#248)', async () => {
    const q = makeTimer({ autoReset: 'question', paused: false, startedAt: Date.now() - 10_000 })
    const r = makeTimer({ autoReset: 'round', paused: false, startedAt: Date.now() - 10_000 })
    await db.timers.bulkAdd([q, r])
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    await act(async () => {
      await result.current.autoReset('question')
    })

    const local = result.current.timers.find(x => x.id === q.id)
    expect(local).toMatchObject({ paused: true, remaining: 60, startedAt: null })
    expect(await db.timers.get(q.id)).toMatchObject({
      paused: true,
      remaining: 60,
      startedAt: null,
    })
    expect(result.current.remaining(q.id)).toBe(60)

    // Round-reset timer is untouched by a question change
    expect(result.current.timers.find(x => x.id === r.id)).toMatchObject({ paused: false })
    expect(await db.timers.get(r.id)).toMatchObject({ paused: false, startedAt: r.startedAt })
  })

  it('resets a question timer that was paused mid-run', async () => {
    const t = makeTimer({ autoReset: 'question', paused: true, startedAt: null, remaining: 42 })
    await db.timers.add(t)
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    await act(async () => {
      await result.current.autoReset('question')
    })

    expect(result.current.timers[0].remaining).toBe(60)
    expect((await db.timers.get(t.id))?.remaining).toBe(60)
  })

  it('resets question timers on a round change', async () => {
    const t = makeTimer({ autoReset: 'question', paused: false, startedAt: Date.now() - 5_000 })
    await db.timers.add(t)
    const { result } = renderHook(() => useTimerList(GAME_ID))
    await flush()

    await act(async () => {
      await result.current.autoReset('round')
    })

    expect(result.current.timers[0]).toMatchObject({ paused: true, remaining: 60 })
  })
})

// ── EditTimerModal ────────────────────────────────────────────────────────────

const noop = () => {}

describe('EditTimerModal', () => {
  it('renders all three pickers', () => {
    render(<EditTimerModal timer={makeTimer()} onSave={noop} onCancel={noop} />)
    expect(screen.getByText('Audio notification')).toBeTruthy()
    expect(screen.getByText('Visual notification (popup)')).toBeTruthy()
    expect(screen.getByText('Auto-reset on screen change')).toBeTruthy()
  })

  it('calls onSave with selected values', () => {
    const onSave = vi.fn()
    render(<EditTimerModal timer={makeTimer()} onSave={onSave} onCancel={noop} />)

    // Scope clicks to the correct picker section to avoid ambiguous text matches
    // (both audio and visual pickers share labels like "Everyone", "Host only")
    const audioSection = screen.getByText('Audio notification').closest('div')!
    const visualSection = screen.getByText('Visual notification (popup)').closest('div')!

    fireEvent.click(within(audioSection).getByText('Everyone')) // audioNotify = both
    fireEvent.click(within(visualSection).getByText('Host only')) // visualNotify = host
    fireEvent.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ audioNotify: 'both', visualNotify: 'host' })
    )
  })

  it('calls onCancel when Escape pressed', () => {
    const onCancel = vi.fn()
    render(<EditTimerModal timer={makeTimer()} onSave={noop} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows existing values pre-selected', () => {
    const timer = makeTimer({ audioNotify: 'players', visualNotify: 'both', autoReset: 'round' })
    render(<EditTimerModal timer={timer} onSave={noop} onCancel={noop} />)
    // Check the option text is rendered
    expect(screen.getAllByText('Players').length).toBeGreaterThan(0)
  })
})

// ── playBeep (smoke test) ─────────────────────────────────────────────────────

describe('playBeep', () => {
  it('does not throw when AudioContext is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() => playBeep()).not.toThrow()
    vi.unstubAllGlobals()
  })
})
