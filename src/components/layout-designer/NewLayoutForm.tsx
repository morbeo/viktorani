import { useState } from 'react'
import { GAME_PHASES, LAYOUT_TARGETS } from '@/db'
import type { GamePhase, LayoutTarget } from '@/db'
import { Button } from '@/components/ui'
import { PHASE_LABELS, TARGET_LABELS } from './labels'

interface NewLayoutFormProps {
  onCreate: (input: { name: string; target: LayoutTarget; phase: GamePhase | null }) => void
}

const field =
  'rounded border border-(--color-border) bg-(--color-cream) px-2 py-1 text-sm text-(--color-ink)'

/** Name, surface and phase for a new, empty layout. */
export function NewLayoutForm({ onCreate }: NewLayoutFormProps) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState<LayoutTarget>('screen')
  const [phase, setPhase] = useState<GamePhase | null>(null)

  return (
    <form
      aria-label="New layout"
      className="flex flex-col gap-2"
      onSubmit={e => {
        e.preventDefault()
        onCreate({ name: name.trim() || `${TARGET_LABELS[target]} layout`, target, phase })
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
      <Button type="submit" size="sm" variant="primary">
        Create layout
      </Button>
    </form>
  )
}
