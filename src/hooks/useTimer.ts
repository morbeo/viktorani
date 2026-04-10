import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import type { Timer, TimerNotify, TimerAutoReset } from '@/db'

export type { TimerNotify, TimerAutoReset }

export interface UseTimerListResult {
  timers: Timer[]
  createTimer: (opts: { gameId: string; label: string; duration: number }) => Promise<Timer>
  startTimer: (id: string) => Promise<void>
  pauseTimer: (id: string) => Promise<void>
  resumeTimer: (id: string) => Promise<void>
  restartTimer: (id: string) => Promise<void>
  deleteTimer: (id: string) => Promise<void>
  updateTimer: (
    id: string,
    patch: Partial<Pick<Timer, 'audioNotify' | 'visualNotify' | 'autoReset' | 'label'>>
  ) => Promise<void>
  pauseAll: () => Promise<void>
  restartAll: () => Promise<void>
  deleteAll: () => Promise<void>
  remaining: (id: string) => number
}

export function useTimerList(gameId: string): UseTimerListResult {
  const [timers, setTimers] = useState<Timer[]>([])
  const [tick, setTick] = useState(0)
  const rafRef = useRef<number | null>(null)
  const timersRef = useRef<Timer[]>([])

  useEffect(() => {
    timersRef.current = timers
  }, [timers])

  useEffect(() => {
    if (!gameId) return
    db.timers
      .where('gameId')
      .equals(gameId)
      .toArray()
      .then(rows => setTimers(rows))
  }, [gameId])

  useEffect(() => {
    let last = performance.now()
    function frame(now: number) {
      if (now - last >= 200) {
        last = now
        setTick(t => t + 1)
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const remaining = useCallback(
    (id: string): number => {
      void tick
      const t = timersRef.current.find(x => x.id === id)
      if (!t) return 0
      if (t.paused || t.startedAt === null) return Math.max(0, t.remaining)
      return Math.max(0, t.remaining - (Date.now() - t.startedAt) / 1000)
    },
    [tick]
  )

  const updateLocal = useCallback((id: string, patch: Partial<Timer>) => {
    setTimers(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const createTimer = useCallback(
    async (opts: { gameId: string; label: string; duration: number }): Promise<Timer> => {
      const timer: Timer = {
        id: crypto.randomUUID(),
        gameId: opts.gameId,
        label: opts.label,
        duration: opts.duration,
        remaining: opts.duration,
        target: 'all',
        message: '',
        visible: true,
        paused: true,
        startedAt: null,
        audioNotify: 'none',
        visualNotify: 'none',
        autoReset: 'none',
      }
      await db.timers.add(timer)
      setTimers(prev => [...prev, timer])
      return timer
    },
    []
  )

  const startTimer = useCallback(
    async (id: string) => {
      const t = timersRef.current.find(x => x.id === id)
      if (!t) return
      const now = Date.now()
      const patch: Partial<Timer> = { paused: false, startedAt: now, remaining: t.duration }
      await db.timers.update(id, patch)
      updateLocal(id, patch)
      transportManager.send({ type: 'TIMER_START', id, duration: t.duration, label: t.label })
    },
    [updateLocal]
  )

  const pauseTimer = useCallback(
    async (id: string) => {
      const t = timersRef.current.find(x => x.id === id)
      if (!t || t.paused) return
      const elapsed = t.startedAt !== null ? (Date.now() - t.startedAt) / 1000 : 0
      const rem = Math.max(0, t.remaining - elapsed)
      const patch: Partial<Timer> = { paused: true, remaining: rem, startedAt: null }
      await db.timers.update(id, patch)
      updateLocal(id, patch)
      transportManager.send({ type: 'TIMER_PAUSE', id })
    },
    [updateLocal]
  )

  const resumeTimer = useCallback(
    async (id: string) => {
      const t = timersRef.current.find(x => x.id === id)
      if (!t || !t.paused) return
      const now = Date.now()
      const patch: Partial<Timer> = { paused: false, startedAt: now }
      await db.timers.update(id, patch)
      updateLocal(id, patch)
      transportManager.send({ type: 'TIMER_RESUME', id })
    },
    [updateLocal]
  )

  const restartTimer = useCallback(
    async (id: string) => {
      const t = timersRef.current.find(x => x.id === id)
      if (!t) return
      await pauseTimer(id)
      const now = Date.now()
      const patch: Partial<Timer> = { paused: false, remaining: t.duration, startedAt: now }
      await db.timers.update(id, patch)
      updateLocal(id, patch)
      transportManager.send({ type: 'TIMER_START', id, duration: t.duration, label: t.label })
    },
    [pauseTimer, updateLocal]
  )

  const updateTimer = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Timer, 'audioNotify' | 'visualNotify' | 'autoReset' | 'label'>>
    ) => {
      await db.timers.update(id, patch)
      updateLocal(id, patch)
    },
    [updateLocal]
  )

  const deleteTimer = useCallback(async (id: string) => {
    await db.timers.delete(id)
    setTimers(prev => prev.filter(t => t.id !== id))
  }, [])

  const pauseAll = useCallback(async () => {
    await Promise.all(timersRef.current.filter(t => !t.paused).map(t => pauseTimer(t.id)))
  }, [pauseTimer])

  const restartAll = useCallback(async () => {
    await Promise.all(timersRef.current.map(t => restartTimer(t.id)))
  }, [restartTimer])

  const deleteAll = useCallback(async () => {
    await db.timers.bulkDelete(timersRef.current.map(t => t.id))
    setTimers([])
  }, [])

  return {
    timers,
    createTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    restartTimer,
    updateTimer,
    deleteTimer,
    pauseAll,
    restartAll,
    deleteAll,
    remaining,
  }
}

// ── Expiry detection ──────────────────────────────────────────────────────────

export interface ExpiryEvent {
  id: string
  label: string
  audioNotify: TimerNotify
  visualNotify: TimerNotify
}

/**
 * Fires once per timer run when remaining hits zero.
 * - Plays a beep if audioNotify includes 'host'
 * - Emits TIMER_EXPIRED so players can react
 * - Calls onExpire for host-side visual overlay
 *
 * Remaining is computed directly from the timer object (not via the
 * `remaining()` callback) to avoid reading a stale timersRef that lags
 * one render behind state. This prevents a false fire immediately after
 * restart, when timersRef still holds the pre-restart (expired) snapshot.
 *
 * The firedRef key is cleared whenever a timer is actively running with
 * time remaining, so a second natural expiry on the same timer correctly
 * re-fires after the previous run's key has been evicted.
 */
export function useTimerExpiry(
  timers: Timer[],
  remaining: (id: string) => number,
  onExpire: (evt: ExpiryEvent) => void
) {
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const t of timers) {
      const runKey = `${t.id}:${t.startedAt}`

      if (t.paused || t.startedAt === null) continue

      // Compute remaining directly from the timer record — avoids the
      // one-render lag that timersRef (used inside remaining()) has after
      // a restart, which would otherwise cause a spurious zero-crossing.
      const elapsed = (Date.now() - t.startedAt) / 1000
      const rem = Math.max(0, t.remaining - elapsed)

      if (rem > 0) {
        // Timer is actively running — evict any stale fired key for this
        // run so a future natural expiry can re-fire correctly.
        firedRef.current.delete(runKey)
        continue
      }

      if (firedRef.current.has(runKey)) continue
      firedRef.current.add(runKey)

      if (t.audioNotify === 'host' || t.audioNotify === 'both') playBeep()
      transportManager.send({ type: 'TIMER_EXPIRED', id: t.id, label: t.label })
      onExpire({
        id: t.id,
        label: t.label,
        audioNotify: t.audioNotify,
        visualNotify: t.visualNotify,
      })
    }
  })
}

/** Plays a short 880 Hz sine beep via Web Audio API. No-ops in test envs. */
export function playBeep(frequency = 880, durationMs = 600) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000)
    osc.onended = () => {
      void ctx.close()
    }
  } catch {
    /* AudioContext unavailable */
  }
}

// ── Auto-reset ────────────────────────────────────────────────────────────────

export type NavChangeType = 'question' | 'round'

/**
 * Pauses and restores timers whose autoReset matches the navigation change.
 * Call from ActiveGame whenever pos changes.
 */
export async function applyAutoReset(timers: Timer[], changeType: NavChangeType) {
  for (const t of timers) {
    if (t.autoReset === 'none') continue
    const matches =
      t.autoReset === 'any' ||
      t.autoReset === changeType ||
      (t.autoReset === 'round' && changeType === 'round')
    if (!matches || (t.paused && t.startedAt === null)) continue
    const patch = { paused: true, remaining: t.duration, startedAt: null } as Partial<Timer>
    await db.timers.update(t.id, patch)
    transportManager.send({ type: 'TIMER_PAUSE', id: t.id })
  }
}

/** Format seconds as MM:SS */
export function formatTime(seconds: number): string {
  const s = Math.ceil(seconds)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
