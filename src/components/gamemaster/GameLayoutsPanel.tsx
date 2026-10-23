import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { LAYOUT_SLOTS } from '@/db'
import type { Game, LayoutSlot, LayoutTarget } from '@/db'
import { setLayoutAssignment, withoutSlot } from '@/db/games'
import { loadGameLayouts } from '@/db/layouts'
import { PHASE_LABELS, TARGET_LABELS } from '@/components/layout-designer/labels'
import { choiceLabel, layoutChoices } from '@/lib/layout-assignments'
import { resolveLayout } from '@/widgets/layouts'

/** Surfaces whose layout the host can choose. */
const SURFACES: LayoutTarget[] = ['screen', 'player', 'gamemaster', 'scoreboard']

const SLOT_LABELS: Record<LayoutSlot, string> = { all: 'All phases', ...PHASE_LABELS }

interface GameLayoutsPanelProps {
  game: Game
  /** Receives the saved change, for the caller's copy of the game. */
  onGameChange: (patch: Partial<Game>) => void
  disabled?: boolean
}

/**
 * The layout each surface of this game uses, per phase (#415). "Automatic" names what is
 * picked without a choice: the choice for all phases, then the game's own layouts, then
 * the templates, then the built-in default.
 */
export function GameLayoutsPanel({ game, onGameChange, disabled = false }: GameLayoutsPanelProps) {
  const [target, setTarget] = useState<LayoutTarget>('screen')
  const stored = useLiveQuery(() => loadGameLayouts(game.id), [game.id])
  const choices = stored ? layoutChoices(stored, target, game.id) : []
  const assignments = game.layoutAssignments?.[target]

  async function choose(slot: LayoutSlot, layoutId: string | null) {
    onGameChange(await setLayoutAssignment(game, target, slot, layoutId))
  }

  function automatic(slot: LayoutSlot) {
    const { layout } = resolveLayout(stored ?? [], {
      target,
      gameId: game.id,
      phase: slot === 'all' ? null : slot,
      assignments: withoutSlot(assignments, slot),
    })
    const choice = choices.find(c => c.bundle.layout.id === layout.id)
    return choice ? choiceLabel(choice) : layout.name
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded border border-(--color-border) p-3">
      <legend className="px-1 text-xs font-semibold uppercase text-(--color-muted)">Layouts</legend>
      <label className="flex flex-col gap-1 text-xs text-(--color-muted)">
        Surface
        <select
          value={target}
          onChange={e => setTarget(e.target.value as LayoutTarget)}
          className="rounded border border-(--color-border) bg-(--color-bg) px-2 py-1 text-sm text-(--color-text)"
        >
          {SURFACES.map(t => (
            <option key={t} value={t}>
              {TARGET_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      {stored &&
        LAYOUT_SLOTS.map(slot => (
          <label
            key={slot}
            className="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs text-(--color-muted)"
          >
            {SLOT_LABELS[slot]}
            <select
              value={assignments?.[slot] ?? ''}
              disabled={disabled}
              onChange={e => void choose(slot, e.target.value || null)}
              className={`min-w-0 rounded border px-2 py-1 text-sm text-(--color-text) ${
                assignments?.[slot]
                  ? 'border-(--color-accent) bg-(--color-accent-subtle)'
                  : 'border-(--color-border) bg-(--color-bg)'
              }`}
            >
              <option value="">Automatic: {automatic(slot)}</option>
              {choices.map(c => (
                <option key={c.bundle.layout.id} value={c.bundle.layout.id}>
                  {choiceLabel(c)}
                </option>
              ))}
            </select>
          </label>
        ))}
      <Link
        to={`/admin/layouts/${game.id}`}
        className="text-xs text-(--color-accent) underline underline-offset-2"
      >
        Edit this game's layouts
      </Link>
    </fieldset>
  )
}
