import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import type { Timer } from '@/db'

export interface UseTimerListResult {
  timers: Timer[]
  createTimer: (opts: { gameId: string; label: string; duration: number }) => Promise<Timer>
  startTimer: (id: string) => Promise<void>
  pauseTimer: (id: string) => Promise<void>
  resumeTimer: (id: string) => Promise<void>
  restartTimer: (id: string) => Promise<void>
  deleteTimer: (id: string) => Promise<void>
  pauseAll: () => Promise<void>
  restartAll: () => Promise<void>
  deleteAll: () => Promise<void>
  /** Remaining seconds for a given timer id (live, from RAF ticker) */
  remaining: (id: string) => number
}

/**
 * Manages all timers for a game session.
 *
 * - Hydrates from DB on mount so a page reload restores running timers.
 * - Drives a single requestAnimationFrame ticker that computes remaining
 *   time from `startedAt` without broadcasting ticks to players.
 * - Emits TIMER_START / TIMER_PAUSE / TIMER_RESUME transport events for
 *   players to render their own local countdown.
 */
export function useTimerList(gameId: string): UseTimerListResult {
  const [timers, setTimers] = useState<Timer[]>([])
  // Live remaining seconds keyed by timer id — updated by RAF ticker
  const [tick, setTick] = useState(0)
  const rafRef = useRef<number | null>(null)
  const timersRef = useRef<Timer[]>([])

  // Keep ref in sync for RAF callback (avoids stale closure)
  useEffect(() => {
    timersRef.current = timers
  }, [timers])

  // Load from DB on mount
  useEffect(() => {
    if (!gameId) return
    db.timers
      .where('gameId')
      .equals(gameId)
      .toArray()
      .then(rows => setTimers(rows))
  }, [gameId])

  // RAF ticker — increments `tick` once per second so callers re-render
  useEffect(() => {
    let last = performance.now()

    function frame(now: number) {
      if (now - last >= 200) {
        // 5fps is enough for second-precision countdown
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

  // Compute live remaining for a timer
  const remaining = useCallback(
    (id: string): number => {
      void tick // subscribe to tick updates
      const t = timersRef.current.find(x => x.id === id)
      if (!t) return 0
      if (t.paused || t.startedAt === null) return Math.max(0, t.remaining)
      const elapsed = (Date.now() - t.startedAt) / 1000
      return Math.max(0, t.remaining - elapsed)
    },
    [tick]
  )

  // ── Mutators ─────────────────────────────────────────────────────────────

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
      // Brief delay then start fresh
      const now = Date.now()
      const patch: Partial<Timer> = {
        paused: false,
        remaining: t.duration,
        startedAt: now,
      }
      await db.timers.update(id, patch)
      updateLocal(id, patch)
      transportManager.send({ type: 'TIMER_START', id, duration: t.duration, label: t.label })
    },
    [pauseTimer, updateLocal]
  )

  const deleteTimer = useCallback(async (id: string) => {
    await db.timers.delete(id)
    setTimers(prev => prev.filter(t => t.id !== id))
  }, [])

  const pauseAll = useCallback(async () => {
    const running = timersRef.current.filter(t => !t.paused)
    await Promise.all(running.map(t => pauseTimer(t.id)))
  }, [pauseTimer])

  const restartAll = useCallback(async () => {
    await Promise.all(timersRef.current.map(t => restartTimer(t.id)))
  }, [restartTimer])

  const deleteAll = useCallback(async () => {
    const ids = timersRef.current.map(t => t.id)
    await db.timers.bulkDelete(ids)
    setTimers([])
  }, [])

  return {
    timers,
    createTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    restartTimer,
    deleteTimer,
    pauseAll,
    restartAll,
    deleteAll,
    remaining,
  }
}

/** Format seconds as MM:SS */
export function formatTime(seconds: number): string {
  const s = Math.ceil(seconds)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
