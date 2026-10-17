import { useState } from 'react'
import { GAME_PHASES, LAYOUT_TARGETS } from '@/db'
import type { GamePhase, LayoutTarget } from '@/db'
import { Button } from '@/components/ui'
import { PHASE_LABELS, TARGET_LABELS } from './labels'

/** A layout a new one can start from: a built-in default or a template. */
export interface LayoutSource {
  id: string
  label: string
  target: LayoutTarget
}

interface NewLayoutFormProps {
  /** Layouts to offer under "Start from", for any target; only the chosen target's show. */
  sources: readonly LayoutSource[]
  onCreate: (input: {
    name: string
    target: LayoutTarget
    phase: GamePhase | null
    /** Id of the layout to copy, or `null` for an empty one. */
    sourceId: string | null
  }) => void
}

const field =
  'rounded border border-(--color-border) bg-(--color-bg) px-2 py-1 text-sm text-(--color-text)'

/** Name, surface and phase for a new layout, empty or copied from a default or template. */
export function NewLayoutForm({ sources, onCreate }: NewLayoutFormProps) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState<LayoutTarget>('screen')
  const [phase, setPhase] = useState<GamePhase | null>(null)
  const [sourceId, setSourceId] = useState('')
  const offered = sources.filter(s => s.target === target)
  // A source picked for another surface no longer applies
  const source = offered.some(s => s.id === sourceId) ? sourceId : ''

  return (
    <form
      aria-label="New layout"
      className="flex flex-col gap-2"
      onSubmit={e => {
        e.preventDefault()
        onCreate({
          name: name.trim() || `${TARGET_LABELS[target]} layout`,
          target,
          phase,
          sourceId: source || null,
        })
        setName('')
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-(--color-muted)">
        Name
        <input className={field} value={name} onChange={e => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-(--color-muted)">
        For
        <select
          className={field}
          value={target}
          onChange={e => setTarget(e.target.value as LayoutTarget)}
        >
          {LAYOUT_TARGETS.map(t => (
            <option key={t} value={t}>
              {TARGET_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-(--color-muted)">
        Phase
        <select
          className={field}
          value={phase ?? ''}
          onChange={e => setPhase((e.target.value || null) as GamePhase | null)}
        >
          <option value="">All phases</option>
          {GAME_PHASES.map(p => (
            <option key={p} value={p}>
              {PHASE_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-(--color-muted)">
        Start from
        <select className={field} value={source} onChange={e => setSourceId(e.target.value)}>
          <option value="">Empty</option>
          {offered.map(s => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="sm" variant="primary">
        Create layout
      </Button>
    </form>
  )
}
