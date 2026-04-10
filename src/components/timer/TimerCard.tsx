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
  onEdit: () => void
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, pct)))
  const color =
    pct > 0.5 ? 'var(--color-green)' : pct > 0.2 ? 'var(--color-gold)' : 'var(--color-red)'
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        strokeWidth="4"
        style={{ stroke: 'var(--color-border)' }}
      />
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

/** Renders a single timer with live ring countdown and host controls. */
export function TimerCard({
  timer,
  remaining,
  onStart,
  onPause,
  onResume,
  onRestart,
  onDelete,
  onEdit,
}: TimerCardProps) {
  const pct = timer.duration > 0 ? remaining / timer.duration : 0
  const isRunning = !timer.paused && timer.startedAt !== null
  const isDone = remaining <= 0 && !timer.paused && timer.startedAt !== null

  // A paused timer with startedAt===null is either:
  //   "Ready"  — never started: remaining === duration
  //   "Paused" — mid-run pause: remaining < duration (elapsed was snapshotted)
  const isNeverStarted =
    timer.paused && timer.startedAt === null && timer.remaining >= timer.duration

  const handleToggle = useCallback(() => {
    if (isNeverStarted) onStart()
    else if (isRunning) onPause()
    else onResume()
  }, [isNeverStarted, isRunning, onStart, onPause, onResume])

  // Notify indicator badges
  const hasAudio = timer.audioNotify !== 'none'
  const hasVisual = timer.visualNotify !== 'none'
  const hasAutoReset = timer.autoReset !== 'none'

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
          style={{ color: isDone ? 'var(--color-red)' : 'var(--color-ink)' }}
        >
          {formatTime(remaining)}
        </span>
      </div>

      {/* Label + status + badges */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-ink)' }}>
          {timer.label || 'Timer'}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {isDone ? 'Time up!' : isRunning ? 'Running' : isNeverStarted ? 'Ready' : 'Paused'}
          </p>
          {hasAudio && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--color-gold)22', color: 'var(--color-gold)' }}
              title={`Audio: ${timer.audioNotify}`}
            >
              🔔 {timer.audioNotify}
            </span>
          )}
          {hasVisual && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--color-gold)22', color: 'var(--color-gold)' }}
              title={`Visual: ${timer.visualNotify}`}
            >
              👁 {timer.visualNotify}
            </span>
          )}
          {hasAutoReset && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--color-border)', color: 'var(--color-muted)' }}
              title={`Auto-reset: ${timer.autoReset}`}
            >
              ↺ {timer.autoReset}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant={isRunning ? 'secondary' : 'primary'}
          onClick={handleToggle}
          title={isRunning ? 'Pause' : isNeverStarted ? 'Start' : 'Resume'}
        >
          {isRunning ? '⏸' : '▶'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRestart}
          title="Restart"
          style={{ color: 'var(--color-muted)' }}
        >
          ↺
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          title="Timer settings"
          style={{ color: 'var(--color-muted)' }}
        >
          ⚙
        </Button>
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
