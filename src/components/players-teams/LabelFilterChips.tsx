import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'

type FilterState = Record<string, 'include' | 'exclude'>

interface Props {
  filter: FilterState
  onChange: (next: FilterState) => void
}

/**
 * Tri-state label filter chips.
 * Each chip cycles: neutral -> include (+) -> exclude (-) -> neutral.
 * "All" chip resets the entire filter.
 */
export default function LabelFilterChips({ filter, onChange }: Props) {
  const labels = useLiveQuery(() => db.managedLabels.orderBy('name').toArray(), [])

  if (!labels || labels.length === 0) return null

  function cycle(labelId: string) {
    const current = filter[labelId]
    const next = { ...filter }
    if (!current) {
      next[labelId] = 'include'
    } else if (current === 'include') {
      next[labelId] = 'exclude'
    } else {
      delete next[labelId]
    }
    onChange(next)
  }

  function reset() {
    onChange({})
  }

  const hasAny = Object.keys(filter).length > 0

  return (
    <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Label filters">
      {/* All / reset chip */}
      <button
        onClick={reset}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border transition-all"
        style={{
          borderColor: hasAny ? 'var(--color-border)' : 'var(--color-gold)',
          background: hasAny ? 'transparent' : 'var(--color-gold-light)',
          color: hasAny ? 'var(--color-muted)' : 'var(--color-gold)',
        }}
        aria-pressed={!hasAny}
        aria-label="Show all labels"
      >
        All
      </button>

      {labels.map(label => {
        const state = filter[label.id]
        const isInclude = state === 'include'
        const isExclude = state === 'exclude'

        return (
          <button
            key={label.id}
            onClick={() => cycle(label.id)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all"
            style={{
              borderColor: isInclude
                ? `color-mix(in srgb, ${label.color} 40%, transparent)`
                : isExclude
                  ? 'color-mix(in srgb, #c0392b 40%, transparent)'
                  : 'var(--color-border)',
              background: isInclude
                ? `color-mix(in srgb, ${label.color} 12%, transparent)`
                : isExclude
                  ? 'color-mix(in srgb, #c0392b 10%, transparent)'
                  : 'transparent',
              color: isInclude ? label.color : isExclude ? '#922b21' : 'var(--color-muted)',
            }}
            aria-label={`Label ${label.name}: ${state ?? 'neutral'}`}
          >
            {isInclude && (
              <span aria-hidden className="font-bold">
                +
              </span>
            )}
            {isExclude && (
              <span aria-hidden className="font-bold">
                −
              </span>
            )}
            {label.name}
          </button>
        )
      })}
    </div>
  )
}
