import { useState } from 'react'
import { Button } from '@/components/ui'
import { TimerCard } from './TimerCard'
import { CreateTimerModal } from './CreateTimerModal'
import type { UseTimerListResult } from '@/hooks/useTimer'

interface TimerPanelProps {
  gameId: string
  hook: UseTimerListResult
}

/**
 * Host-facing panel: list of active timers with individual + bulk controls
 * and a button to create new ones.
 */
export function TimerPanel({ gameId, hook }: TimerPanelProps) {
  const [showCreate, setShowCreate] = useState(false)

  const {
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
  } = hook

  async function handleCreate(label: string, duration: number) {
    const t = await createTimer({ gameId, label, duration })
    setShowCreate(false)
    // Auto-start immediately
    await startTimer(t.id)
  }

  return (
    <>
      {showCreate && (
        <CreateTimerModal onConfirm={handleCreate} onCancel={() => setShowCreate(false)} />
      )}

      <div
        className="rounded-xl border flex flex-col gap-3 p-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)' }}
          >
            Timers
            {timers.length > 0 && (
              <span
                className="ml-2 px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'var(--color-gold)22', color: 'var(--color-gold)' }}
              >
                {timers.length}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            {timers.length > 1 && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={pauseAll}
                  style={{ color: 'var(--color-muted)' }}
                >
                  Pause all
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={restartAll}
                  style={{ color: 'var(--color-muted)' }}
                >
                  Restart all
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={deleteAll}
                  style={{ color: 'var(--color-muted)' }}
                >
                  Clear all
                </Button>
              </>
            )}
            <Button size="sm" variant="primary" onClick={() => setShowCreate(true)}>
              + Timer
            </Button>
          </div>
        </div>

        {/* Timer list */}
        {timers.length === 0 ? (
          <p className="text-xs py-2 text-center" style={{ color: 'var(--color-muted)' }}>
            No active timers — press <strong>+ Timer</strong> to add one.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {timers.map(t => (
              <TimerCard
                key={t.id}
                timer={t}
                remaining={remaining(t.id)}
                onStart={() => void startTimer(t.id)}
                onPause={() => void pauseTimer(t.id)}
                onResume={() => void resumeTimer(t.id)}
                onRestart={() => void restartTimer(t.id)}
                onDelete={() => void deleteTimer(t.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
