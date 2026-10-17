import { GAME_PHASES } from '@/db'
import type { GamePhase } from '@/db'
import { PHASE_LABELS } from '@/components/layout-designer/labels'

interface PhaseControlProps {
  /** The phase worked out from the game's state. */
  auto: GamePhase
  /** The GM's choice, or `null` to follow the game. */
  override: GamePhase | null
  onOverride: (phase: GamePhase | null) => void
}

/**
 * Which phase every surface's layout is picked for: the game's own phase, or one the GM
 * holds by hand (say the scoreboard between rounds) until set back to automatic.
 */
export function PhaseControl({ auto, override, onOverride }: PhaseControlProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-(--color-muted)">
      Layouts for
      <select
        value={override ?? ''}
        onChange={e => onOverride((e.target.value || null) as GamePhase | null)}
        className={`rounded border px-2 py-1 text-sm ${
          override
            ? 'border-(--color-accent) bg-(--color-accent-subtle) text-(--color-text)'
            : 'border-(--color-border) bg-(--color-bg) text-(--color-text)'
        }`}
      >
        <option value="">Automatic ({PHASE_LABELS[auto]})</option>
        {GAME_PHASES.filter(p => p !== 'lobby' && p !== 'ended').map(p => (
          <option key={p} value={p}>
            {PHASE_LABELS[p]}
          </option>
        ))}
      </select>
    </label>
  )
}
