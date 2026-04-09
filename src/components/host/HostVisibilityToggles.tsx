import type { Game } from '@/db'
import { useGameVisibility } from '@/hooks/useGameVisibility'
import type { VisibilityState } from '@/hooks/useGameVisibility'

interface ToggleProps {
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: () => void
}

function Toggle({ label, hint, checked, disabled, onChange }: ToggleProps) {
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
        aria-label={label}
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
  { key: 'showQuestion', label: 'Show question', hint: 'Players can see the question text' },
  { key: 'showAnswers', label: 'Show answers', hint: 'Players can see the answer options' },
  { key: 'showMedia', label: 'Show media', hint: 'Players can see images, audio, or video' },
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
      <div
        className="flex flex-col gap-4 rounded-lg border p-4"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        {TOGGLES.map(({ key, label, hint }) => (
          <Toggle
            key={key}
            label={label}
            hint={hint}
            checked={visibility[key]}
            disabled={saving}
            onChange={() => toggle(key)}
          />
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
