import { useState, useEffect } from 'react'
import { Button } from '@/components/ui'
import type { TimerNotify, TimerAutoReset } from '@/hooks/useTimer'
import type { Timer } from '@/db'

interface EditTimerModalProps {
  timer: Timer
  onSave: (
    patch: Partial<Pick<Timer, 'audioNotify' | 'visualNotify' | 'autoReset' | 'label'>>
  ) => void
  onCancel: () => void
}

// ── Generic 4-state picker ────────────────────────────────────────────────────

function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; description: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-muted)' }}
      >
        {label}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all"
            style={{
              borderColor: value === opt.value ? 'var(--color-gold)' : 'var(--color-border)',
              background: value === opt.value ? 'var(--color-gold)18' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <span
              className="text-xs font-semibold"
              style={{ color: value === opt.value ? 'var(--color-gold)' : 'var(--color-ink)' }}
            >
              {opt.label}
            </span>
            <span className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {opt.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Option definitions ────────────────────────────────────────────────────────

const AUDIO_OPTIONS: { value: TimerNotify; label: string; description: string }[] = [
  { value: 'none', label: 'Off', description: 'No sound' },
  { value: 'host', label: 'Host only', description: 'Beep on GM screen' },
  { value: 'players', label: 'Players', description: 'Beep on player screens' },
  { value: 'both', label: 'Everyone', description: 'GM + all players' },
]

const VISUAL_OPTIONS: { value: TimerNotify; label: string; description: string }[] = [
  { value: 'none', label: 'Off', description: 'No popup' },
  { value: 'host', label: 'Host only', description: 'Popup on GM screen' },
  { value: 'players', label: 'Players', description: 'Popup on player screens' },
  { value: 'both', label: 'Everyone', description: 'GM + all players' },
]

const RESET_OPTIONS: { value: TimerAutoReset; label: string; description: string }[] = [
  { value: 'none', label: 'Manual', description: 'Never auto-reset' },
  { value: 'question', label: 'Per question', description: 'Reset on question change' },
  { value: 'round', label: 'Per round', description: 'Reset on round change' },
  { value: 'any', label: 'Any nav', description: 'Reset on any slide change' },
]

// ── Modal ─────────────────────────────────────────────────────────────────────

/**
 * Settings sheet for a single timer.
 * Three 4-state pickers: audio notify, visual notify, auto-reset.
 */
export function EditTimerModal({ timer, onSave, onCancel }: EditTimerModalProps) {
  const [label, setLabel] = useState(timer.label)
  const [audioNotify, setAudioNotify] = useState<TimerNotify>(timer.audioNotify)
  const [visualNotify, setVisualNotify] = useState<TimerNotify>(timer.visualNotify)
  const [autoReset, setAutoReset] = useState<TimerAutoReset>(timer.autoReset)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function handleSave() {
    onSave({ label: label.trim() || 'Timer', audioNotify, visualNotify, autoReset })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="rounded-2xl border shadow-xl w-full max-w-md mx-4 flex flex-col gap-5 p-6 overflow-y-auto"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-cream)',
          maxHeight: '90vh',
        }}
      >
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-ink)' }}
        >
          Timer settings
        </h2>

        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-muted)' }}
          >
            Label
          </label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-ink)',
              outline: 'none',
            }}
          />
        </div>

        <Picker
          label="Audio notification"
          value={audioNotify}
          options={AUDIO_OPTIONS}
          onChange={setAudioNotify}
        />

        <Picker
          label="Visual notification (popup)"
          value={visualNotify}
          options={VISUAL_OPTIONS}
          onChange={setVisualNotify}
        />

        <Picker
          label="Auto-reset on screen change"
          value={autoReset}
          options={RESET_OPTIONS}
          onChange={setAutoReset}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
