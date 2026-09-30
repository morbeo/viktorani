import type { Game } from '@/db'
import { useGameVisibility } from '@/hooks/useGameVisibility'
import type { VisibilityState } from '@/hooks/useGameVisibility'
import type { VisibilityTarget } from '@/transport/types'

interface ToggleProps {
  label: string
  /** Accessible name; defaults to `label`. */
  name?: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: () => void
}

function Toggle({ label, name, hint, checked, disabled, onChange }: ToggleProps) {
  return (
    <label
      className="flex items-center justify-between gap-4 cursor-pointer select-none"
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {hint}
        </span>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={name ?? label}
        disabled={disabled}
        onClick={onChange}
        className="relative shrink-0 w-11 h-6 rounded-full border-2 transition-colors"
        style={{
          background: checked ? '#16a34a' : 'var(--color-border)',
          borderColor: checked ? '#16a34a' : 'var(--color-border)',
        }}
      >
        <span
          className="block w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(2px)' }}
        />
      </button>
    </label>
  )
}

const TOGGLES: Array<{ key: keyof VisibilityState; label: string; hint: string }> = [
  { key: 'showQuestion', label: 'Show question', hint: 'The question text' },
  { key: 'showAnswers', label: 'Show answers', hint: 'The answer options' },
  { key: 'showMedia', label: 'Show media', hint: 'Images, audio, or video' },
]

const TARGETS: Array<{ target: VisibilityTarget; title: string }> = [
  { target: 'players', title: 'Player phones' },
  { target: 'screen', title: 'Screen' },
]

interface HostVisibilityTogglesProps {
  game: Game
}

export function HostVisibilityToggles({ game }: HostVisibilityTogglesProps) {
  const { visibility, toggle, saving, error } = useGameVisibility(game)
  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-muted)' }}
      >
        Visibility
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TARGETS.map(({ target, title }) => (
          <div
            key={target}
            className="flex flex-col gap-4 rounded-lg border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              {title}
            </p>
            {TOGGLES.map(({ key, label, hint }) => (
              <Toggle
                key={key}
                label={label}
                name={`${label} on ${title.toLowerCase()}`}
                hint={hint}
                checked={visibility[target][key]}
                disabled={saving}
                onChange={() => toggle(target, key)}
              />
            ))}
          </div>
        ))}
      </div>
      {error && (
        <p className="text-xs" style={{ color: 'var(--color-red)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
