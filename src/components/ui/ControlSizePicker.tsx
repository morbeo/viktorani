import { useContext } from 'react'
import { ControlSizeContext } from './controlSize'
import type { ControlSize } from './controlSize'

const OPTIONS: Array<{ size: ControlSize; label: string; name: string }> = [
  { size: 'sm', label: 'S', name: 'Small' },
  { size: 'md', label: 'M', name: 'Medium' },
  { size: 'lg', label: 'L', name: 'Large' },
]

/** Segmented S / M / L switch for the game master control size. Renders nothing outside a provider. */
export function ControlSizePicker() {
  const ctx = useContext(ControlSizeContext)
  if (!ctx) return null
  return (
    <div
      role="radiogroup"
      aria-label="Control size"
      className="inline-flex rounded border overflow-hidden shrink-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {OPTIONS.map(({ size, label, name }) => {
        const active = ctx.size === size
        return (
          <button
            key={size}
            role="radio"
            aria-checked={active}
            aria-label={`${name} controls`}
            title={`${name} controls`}
            onClick={() => ctx.setSize(size)}
            className="px-2 py-0.5 text-xs font-medium transition-colors"
            style={{
              background: active ? 'var(--color-ink)' : 'transparent',
              color: active ? 'var(--color-cream)' : 'var(--color-muted)',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
