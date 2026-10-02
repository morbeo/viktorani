import { Select } from '@/components/ui'
import { useAppSettings } from '@/hooks/useAppSettings'
import { MAX_TIMER_SECONDS } from '@/lib/app-settings'
import type { AppSettings } from '@/lib/app-settings'
import { AUDIO_OPTIONS, VISUAL_OPTIONS, RESET_OPTIONS } from '@/components/timer/timer-options'

function toNumber(value: string): number {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** What a new timer starts with: duration, notifications and auto-reset. */
export default function TimerSettings() {
  const [settings, update] = useAppSettings()
  const minutes = Math.floor(settings.timerDuration / 60)
  const seconds = settings.timerDuration % 60

  function setDuration(m: number, s: number) {
    update({ timerDuration: Math.min(MAX_TIMER_SECONDS, Math.max(1, m * 60 + s)) })
  }

  const inputStyle = {
    borderColor: 'var(--color-border)',
    background: 'var(--color-cream)',
    color: 'var(--color-ink)',
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
          New timers
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          Defaults for timers created on the game master page. Existing timers keep their settings.
        </p>
      </div>
      <fieldset className="flex items-end gap-2">
        <legend className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>
          Duration
        </legend>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          Minutes
          <input
            type="number"
            min={0}
            max={99}
            value={minutes}
            onChange={e => setDuration(Math.min(99, toNumber(e.target.value)), seconds)}
            className="w-20 px-3 py-2 rounded border text-sm outline-none"
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          Seconds
          <input
            type="number"
            min={0}
            max={59}
            value={seconds}
            onChange={e => setDuration(minutes, Math.min(59, toNumber(e.target.value)))}
            className="w-20 px-3 py-2 rounded border text-sm outline-none"
            style={inputStyle}
          />
        </label>
      </fieldset>
      <Select
        id="timer-audio-notify"
        label="Audio notification"
        value={settings.timerAudioNotify}
        options={AUDIO_OPTIONS}
        onChange={e =>
          update({ timerAudioNotify: e.target.value as AppSettings['timerAudioNotify'] })
        }
      />
      <Select
        id="timer-visual-notify"
        label="Visual notification (popup)"
        value={settings.timerVisualNotify}
        options={VISUAL_OPTIONS}
        onChange={e =>
          update({ timerVisualNotify: e.target.value as AppSettings['timerVisualNotify'] })
        }
      />
      <Select
        id="timer-auto-reset"
        label="Auto-reset"
        value={settings.timerAutoReset}
        options={RESET_OPTIONS}
        onChange={e => update({ timerAutoReset: e.target.value as AppSettings['timerAutoReset'] })}
      />
    </section>
  )
}
