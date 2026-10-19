import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui'
import { getSettings } from '@/lib/app-settings'
import { SCOPE_TIMER_LABELS, TIMER_SCOPES } from './timer-options'
import type { TimerScope } from './timer-options'

interface CreateTimerModalProps {
  /** `scope` is set when the host picked a shortcut; the label is already filled in. */
  onConfirm: (label: string, duration: number, scope?: TimerScope) => void
  onCancel: () => void
}

const PRESETS = [
  { label: '30 s', seconds: 30 },
  { label: '1 m', seconds: 60 },
  { label: '2 m', seconds: 120 },
  { label: '5 m', seconds: 300 },
]

/**
 * Modal dialog for creating a new timer.
 * Traps focus and closes on Escape.
 */
export function CreateTimerModal({ onConfirm, onCancel }: CreateTimerModalProps) {
  const [label, setLabel] = useState('')
  const [scope, setScope] = useState<TimerScope | undefined>()
  // Start from the default duration in the app settings
  const [minutes, setMinutes] = useState(() => Math.floor(getSettings().timerDuration / 60))
  const [seconds, setSeconds] = useState(() => getSettings().timerDuration % 60)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    labelRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const applyPreset = useCallback((secs: number) => {
    setMinutes(Math.floor(secs / 60))
    setSeconds(secs % 60)
  }, [])

  function handleSubmit() {
    const dur = minutes * 60 + seconds
    if (dur <= 0) return
    onConfirm(label.trim() || (scope ? SCOPE_TIMER_LABELS[scope] : 'Timer'), dur, scope)
  }

  const totalSeconds = minutes * 60 + seconds

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div className="rounded-2xl border shadow-xl w-full max-w-sm mx-4 flex flex-col gap-5 p-6 border-border bg-bg">
        <h2 className="text-lg font-bold text-text font-display">New Timer</h2>

        {/* Scope shortcuts */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">For</p>
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Timer for">
            {TIMER_SCOPES.map(s => (
              <button
                key={s.value}
                type="button"
                aria-pressed={scope === s.value}
                onClick={() => setScope(prev => (prev === s.value ? undefined : s.value))}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                  scope === s.value
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-transparent text-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {scope
              ? `Resets ${scope === 'game' ? 'only when you restart it' : `on every ${scope} change`}.`
              : 'Pick one to reset the timer with it, or leave it as a custom timer.'}
          </p>
        </div>

        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Label (optional)
          </label>
          <input
            ref={labelRef}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={scope ? SCOPE_TIMER_LABELS[scope] : 'e.g. Round 1 · Team A'}
            className="w-full px-3 py-2 rounded-lg border text-sm border-border bg-surface text-text"
            style={{
              outline: 'none',
            }}
          />
        </div>

        {/* Presets */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Duration</p>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.seconds}
                onClick={() => applyPreset(p.seconds)}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                style={{
                  borderColor:
                    totalSeconds === p.seconds ? 'var(--color-accent)' : 'var(--color-border)',
                  background: totalSeconds === p.seconds ? 'var(--color-accent)22' : 'transparent',
                  color: totalSeconds === p.seconds ? 'var(--color-accent)' : 'var(--color-muted)',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom min/sec spinners */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-xs text-muted">Min</label>
              <input
                type="number"
                min={0}
                max={99}
                value={minutes}
                onChange={e => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg border text-sm mono text-center border-border bg-surface text-text"
                style={{
                  outline: 'none',
                }}
              />
            </div>
            <span className="mt-4 font-bold text-lg text-muted">:</span>
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-xs text-muted">Sec</label>
              <input
                type="number"
                min={0}
                max={59}
                value={seconds}
                onChange={e => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                className="w-full px-3 py-2 rounded-lg border text-sm mono text-center border-border bg-surface text-text"
                style={{
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={totalSeconds <= 0}>
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}
