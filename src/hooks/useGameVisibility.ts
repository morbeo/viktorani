import { useState, useCallback } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import type { Game } from '@/db'

/** The three toggleable visibility flags for the current question. */
export interface VisibilityState {
  showQuestion: boolean
  showAnswers: boolean
  showMedia: boolean
}

/** Return value of {@link useGameVisibility}. */
export interface UseGameVisibilityResult {
  /** Current visibility state — initialised from the game record. */
  visibility: VisibilityState
  /**
   * Toggle one visibility flag.
   * Persists the change to IndexedDB and broadcasts a `VISIBILITY` transport event.
   * On failure, reverts the optimistic local update.
   */
  toggle: (key: keyof VisibilityState) => Promise<void>
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
 * associated media to players. Each toggle is persisted to the `games` table
 * and broadcast via the `VISIBILITY` transport event so all connected players
 * update immediately.
 *
 * Optimistic updates are applied locally before the DB write completes.
 * If the write fails, the previous state is restored and `error` is set.
 *
 * @param game - The active game. Initial visibility values are read from this record.
 *
 * @example
 * ```tsx
 * function VisibilityPanel({ game }: { game: Game }) {
 *   const { visibility, toggle, saving } = useGameVisibility(game)
 *   return (
 *     <button onClick={() => toggle('showQuestion')} disabled={saving}>
 *       {visibility.showQuestion ? 'Hide' : 'Show'} Question
 *     </button>
 *   )
 * }
 * ```
 */
export function useGameVisibility(game: Game): UseGameVisibilityResult {
  const [visibility, setVisibility] = useState<VisibilityState>({
    showQuestion: game.showQuestion,
    showAnswers: game.showAnswers,
    showMedia: game.showMedia,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(
    async (key: keyof VisibilityState) => {
      const next: VisibilityState = { ...visibility, [key]: !visibility[key] }
      setVisibility(next)
      setSaving(true)
      setError(null)

      try {
        await db.games.update(game.id, {
          showQuestion: next.showQuestion,
          showAnswers: next.showAnswers,
          showMedia: next.showMedia,
          updatedAt: Date.now(),
        })

        transportManager.send({
          type: 'VISIBILITY',
          showQuestion: next.showQuestion,
          showAnswers: next.showAnswers,
          showMedia: next.showMedia,
        })
      } catch (err) {
        setVisibility(visibility)
        setError(err instanceof Error ? err.message : 'Failed to save visibility')
      } finally {
        setSaving(false)
      }
    },
    [game.id, visibility]
  )

  return { visibility, toggle, saving, error }
}
