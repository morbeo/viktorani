import type { ReactNode } from 'react'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { AppSettings } from '@/lib/app-settings'

interface Option<T> {
  value: T
  label: string
  description: string
}

const THEME_OPTIONS: Option<AppSettings['theme']>[] = [
  { value: 'system', label: 'System', description: 'Follow the device setting' },
  { value: 'light', label: 'Light', description: 'Always light' },
  { value: 'dark', label: 'Dark', description: 'Always dark' },
]

const ACTION_MODE_OPTIONS: Option<AppSettings['actionMode']>[] = [
  { value: 'icons', label: 'Icons', description: 'Show icon only' },
  { value: 'text', label: 'Text', description: 'Show label only' },
  { value: 'both', label: 'Icons + text', description: 'Show icon and label' },
]

const CONTROL_SIZE_OPTIONS: Option<AppSettings['controlSize']>[] = [
  { value: 'sm', label: 'Small', description: 'Small game master controls' },
  { value: 'md', label: 'Medium', description: 'Medium game master controls' },
  { value: 'lg', label: 'Large', description: 'Large game master controls' },
]

function Choice<T extends string>({
  title,
  hint,
  options,
  value,
  onChange,
}: {
  title: string
  hint: ReactNode
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
          {title}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {hint}
        </p>
      </div>
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex-1 flex flex-col items-center gap-1 rounded-lg border py-3 px-2 text-xs font-medium transition-all"
            style={{
              borderColor: value === opt.value ? 'var(--color-ink)' : 'var(--color-border)',
              background: value === opt.value ? 'var(--color-ink)' : 'var(--color-surface)',
              color: value === opt.value ? 'var(--color-cream)' : 'var(--color-muted)',
            }}
            aria-pressed={value === opt.value}
            aria-label={opt.description}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  )
}

/** Theme, action buttons and game master control size. */
export default function AppearanceSettings() {
  const [settings, update] = useAppSettings()
  return (
    <div className="flex flex-col gap-10">
      <Choice
        title="Theme"
        hint="Light or dark colours for the whole app"
        options={THEME_OPTIONS}
        value={settings.theme}
        onChange={theme => update({ theme })}
      />
      <Choice
        title="Action buttons"
        hint="How row actions are displayed throughout the app"
        options={ACTION_MODE_OPTIONS}
        value={settings.actionMode}
        onChange={actionMode => update({ actionMode })}
      />
      <Choice
        title="Game master controls"
        hint="Size of the buttons while running a game; also set with S / M / L on that page"
        options={CONTROL_SIZE_OPTIONS}
        value={settings.controlSize}
        onChange={controlSize => update({ controlSize })}
      />
    </div>
  )
}
