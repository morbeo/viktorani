import { useState, useCallback } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import type { Game } from '@/db'

export interface VisibilityState {
  showQuestion: boolean
  showAnswers: boolean
  showMedia: boolean
}

export interface UseGameVisibilityResult {
  visibility: VisibilityState
  toggle: (key: keyof VisibilityState) => Promise<void>
  saving: boolean
  error: string | null
}

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
