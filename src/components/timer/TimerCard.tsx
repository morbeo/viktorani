import { useCallback } from 'react'
import { Button } from '@/components/ui'
import { formatTime } from '@/hooks/useTimer'
import type { Timer } from '@/db'

interface TimerCardProps {
  timer: Timer
  remaining: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onDelete: () => void
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, pct)))

  const color =
    pct > 0.5 ? 'var(--color-green)' : pct > 0.2 ? 'var(--color-gold)' : 'var(--color-red)'

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      {/* Track */}
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        strokeWidth="4"
        style={{ stroke: 'var(--color-border)' }}
      />
      {/* Progress */}
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ stroke: color, transition: 'stroke-dashoffset 0.4s linear, stroke 0.4s' }}
        transform="rotate(-90 36 36)"
      />
    </svg>
  )
}

/**
 * Renders a single timer with live ring countdown and host controls.
 */
export function TimerCard({
  timer,
  remaining,
  onStart,
  onPause,
  onResume,
  onRestart,
  onDelete,
}: TimerCardProps) {
  const pct = timer.duration > 0 ? remaining / timer.duration : 0
  const isRunning = !timer.paused && timer.startedAt !== null
  const isDone = remaining <= 0 && !timer.paused && timer.startedAt !== null

  const handleToggle = useCallback(() => {
    if (timer.startedAt === null && timer.paused) {
      // Never started
      onStart()
    } else if (isRunning) {
      onPause()
    } else {
      onResume()
    }
  }, [timer.startedAt, timer.paused, isRunning, onStart, onPause, onResume])

  return (
    <div
      className="rounded-xl border flex items-center gap-4 px-4 py-3"
      style={{
        borderColor: isDone ? 'var(--color-red)' : 'var(--color-border)',
        background: isDone ? 'var(--color-red)0d' : 'var(--color-surface)',
        transition: 'border-color 0.3s, background 0.3s',
      }}
    >
      {/* Ring */}
      <div className="relative flex items-center justify-center">
        <ProgressRing pct={pct} />
        <span
          className="mono absolute text-sm font-bold tabular-nums"
          style={{
            color: isDone ? 'var(--color-red)' : 'var(--color-ink)',
          }}
        >
          {formatTime(remaining)}
        </span>
      </div>

      {/* Label + status */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-ink)' }}>
          {timer.label || 'Timer'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {isDone
            ? 'Time up!'
            : isRunning
              ? 'Running'
              : timer.startedAt === null && timer.paused
                ? 'Ready'
                : 'Paused'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Play / Pause */}
        <Button
          size="sm"
          variant={isRunning ? 'secondary' : 'primary'}
          onClick={handleToggle}
          title={isRunning ? 'Pause' : timer.startedAt === null ? 'Start' : 'Resume'}
        >
          {isRunning ? '⏸' : '▶'}
        </Button>

        {/* Restart */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onRestart}
          title="Restart"
          style={{ color: 'var(--color-muted)' }}
        >
          ↺
        </Button>

        {/* Delete */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          title="Delete timer"
          style={{ color: 'var(--color-muted)' }}
        >
          ✕
        </Button>
      </div>
    </div>
  )
}
