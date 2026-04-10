import { useEffect, useState, useRef, useCallback } from 'react'
import { useTransportEvents } from '@/hooks/useTransport'
import { formatTime, playBeep } from '@/hooks/useTimer'
import { TimerExpiredOverlay } from '@/components/timer/TimerExpiredOverlay'
import type { GameEvent } from '@/transport/types'

// ── Player-side timer state ───────────────────────────────────────────────────

interface PlayerTimer {
  id: string
  label: string
  duration: number
  remaining: number
  startedAt: number | null
  paused: boolean
}

interface ExpiredEntry {
  id: string
  label: string
}

function usePlayerTimers() {
  const [timers, setTimers] = useState<PlayerTimer[]>([])
  const [expired, setExpired] = useState<ExpiredEntry | null>(null)
  const [tick, setTick] = useState(0)
  const rafRef = useRef<number | null>(null)
  const timersRef = useRef<PlayerTimer[]>([])

  useEffect(() => {
    timersRef.current = timers
  }, [timers])

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

  const handleEvent = useCallback((event: GameEvent) => {
    if (event.type === 'TIMER_START') {
      const { id, duration, label } = event
      setTimers(prev => {
        const updated: PlayerTimer = {
          id,
          label,
          duration,
          remaining: duration,
          startedAt: Date.now(),
          paused: false,
        }
        return prev.find(t => t.id === id)
          ? prev.map(t => (t.id === id ? updated : t))
          : [...prev, updated]
      })
    }
    if (event.type === 'TIMER_PAUSE') {
      setTimers(prev =>
        prev.map(t => {
          if (t.id !== event.id) return t
          const elapsed = t.startedAt !== null ? (Date.now() - t.startedAt) / 1000 : 0
          return {
            ...t,
            paused: true,
            remaining: Math.max(0, t.remaining - elapsed),
            startedAt: null,
          }
        })
      )
    }
    if (event.type === 'TIMER_RESUME') {
      setTimers(prev =>
        prev.map(t => (t.id === event.id ? { ...t, paused: false, startedAt: Date.now() } : t))
      )
    }
    if (event.type === 'TIMER_EXPIRED') {
      // Host controls audio/visual flags via transport; players always get both
      // (the host already filtered — if this event arrived, players should react)
      playBeep()
      setExpired({ id: event.id, label: event.label })
    }
  }, [])

  return { timers, remaining, handleEvent, expired, dismissExpired: () => setExpired(null) }
}

// ── Player timer card ─────────────────────────────────────────────────────────

function PlayerTimerCard({ timer, remaining }: { timer: PlayerTimer; remaining: number }) {
  const pct = timer.duration > 0 ? remaining / timer.duration : 0
  const isDone = remaining <= 0 && !timer.paused && timer.startedAt !== null
  const isRunning = !timer.paused && timer.startedAt !== null
  const r = 44
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, pct)))
  const color =
    pct > 0.5 ? 'var(--color-green)' : pct > 0.2 ? 'var(--color-gold)' : 'var(--color-red)'

  return (
    <div
      className="rounded-2xl border flex flex-col items-center gap-3 p-6"
      style={{
        borderColor: isDone ? 'var(--color-red)' : 'var(--color-border)',
        background: isDone ? 'var(--color-red)0d' : 'var(--color-surface)',
        transition: 'border-color 0.3s, background 0.3s',
      }}
    >
      {timer.label && (
        <p className="text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
          {timer.label}
        </p>
      )}
      <div className="relative flex items-center justify-center">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="6"
            style={{ stroke: 'var(--color-border)' }}
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ stroke: color, transition: 'stroke-dashoffset 0.4s linear, stroke 0.4s' }}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span
          className="mono absolute text-2xl font-bold tabular-nums"
          style={{ color: isDone ? 'var(--color-red)' : 'var(--color-ink)' }}
        >
          {formatTime(remaining)}
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        {isDone ? '⏰ Time up!' : isRunning ? 'Running' : 'Paused'}
      </p>
    </div>
  )
}

// ── Main Play page ────────────────────────────────────────────────────────────

export default function Play() {
  const { timers, remaining, handleEvent, expired, dismissExpired } = usePlayerTimers()

  useTransportEvents(
    useCallback(
      event => {
        if (
          event.type === 'TIMER_START' ||
          event.type === 'TIMER_PAUSE' ||
          event.type === 'TIMER_RESUME' ||
          event.type === 'TIMER_EXPIRED'
        ) {
          handleEvent(event as GameEvent)
        }
      },
      [handleEvent]
    )
  )

  const activeTimers = timers.filter(t => t.startedAt !== null || !t.paused)

  return (
    <>
      {expired && <TimerExpiredOverlay label={expired.label} onDismiss={dismissExpired} />}

      {activeTimers.length === 0 ? (
        <div
          className="flex items-center justify-center h-screen"
          style={{ background: 'var(--color-cream)' }}
        >
          <p style={{ color: 'var(--color-muted)' }}>Waiting for host…</p>
        </div>
      ) : (
        <div
          className="min-h-screen px-4 py-8 flex flex-col items-center gap-6"
          style={{ background: 'var(--color-cream)' }}
        >
          <h1
            className="text-2xl font-black"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-ink)' }}
          >
            Timers
          </h1>
          <div className="w-full max-w-sm flex flex-col gap-4">
            {activeTimers.map(t => (
              <PlayerTimerCard key={t.id} timer={t} remaining={remaining(t.id)} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
