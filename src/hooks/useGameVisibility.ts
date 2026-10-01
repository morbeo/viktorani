import { useState, useCallback } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import type { Game, GameVisibility, TargetVisibility } from '@/db'
import type { VisibilityTarget } from '@/transport/types'

/** The three toggleable visibility flags for the current question on one target. */
export type VisibilityState = TargetVisibility

/** Return value of {@link useGameVisibility}. */
export interface UseGameVisibilityResult {
  /** Current visibility for both targets — initialised from the game record. */
  visibility: GameVisibility
  /**
   * Toggle one visibility flag on one target.
   * Persists the change to IndexedDB and broadcasts a `VISIBILITY` event for that target.
   * On failure, reverts the optimistic local update.
   */
  toggle: (target: VisibilityTarget, key: keyof VisibilityState) => Promise<void>
  /** `true` while the DB write is in flight. */
  saving: boolean
  /** Non-null if the last `toggle` call failed. */
  error: string | null
}

/**
 * Manages question-visibility state for the GM view.
 *
 * @remarks
 * The GM can independently reveal the question text, answer options, and
 * associated media on player phones and on the projector screen. Each toggle
 * is persisted to the `games` table and broadcast via the `VISIBILITY`
 * transport event for its target so connected devices update immediately.
 *
 * Optimistic updates are applied locally before the DB write completes.
 * If the write fails, the previous state is restored and `error` is set.
 *
 * @param game - The active game. Initial visibility values are read from this record.
 * @param onGameChange - Receives the saved patch (`visibility`, `updatedAt`) so the caller can
 *   merge it into its own `game` state.
 *
 * @example
 * ```tsx
 * function VisibilityPanel({ game }: { game: Game }) {
 *   const { visibility, toggle, saving } = useGameVisibility(game)
 *   return (
 *     <button onClick={() => toggle('players', 'showQuestion')} disabled={saving}>
 *       {visibility.players.showQuestion ? 'Hide' : 'Show'} Question
 *     </button>
 *   )
 * }
 * ```
 */
export function useGameVisibility(
  game: Game,
  onGameChange?: (patch: Partial<Game>) => void
): UseGameVisibilityResult {
  const [visibility, setVisibility] = useState<GameVisibility>(game.visibility)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(
    async (target: VisibilityTarget, key: keyof VisibilityState) => {
      const flags: TargetVisibility = { ...visibility[target], [key]: !visibility[target][key] }
      const next: GameVisibility = { ...visibility, [target]: flags }
      setVisibility(next)
      setSaving(true)
      setError(null)

      try {
        const patch = { visibility: next, updatedAt: Date.now() }
        await db.games.update(game.id, patch)
        onGameChange?.(patch)
        transportManager.send({ type: 'VISIBILITY', target, ...flags })
      } catch (err) {
        setVisibility(visibility)
        setError(err instanceof Error ? err.message : 'Failed to save visibility')
      } finally {
        setSaving(false)
      }
    },
    [game.id, visibility, onGameChange]
  )

  return { visibility, toggle, saving, error }
}
