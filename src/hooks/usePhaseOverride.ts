import { useCallback, useSyncExternalStore } from 'react'
import type { GamePhase } from '@/db'
import { readPhaseOverride, subscribePhaseOverride, writePhaseOverride } from '@/lib/layout-phase'

/**
 * The GM's layout phase override for `gameId` (`null`: follow the game) and a setter. Kept
 * in local storage, so the projector window on the same machine follows it too.
 */
export function usePhaseOverride(gameId: string | null) {
  const override = useSyncExternalStore(subscribePhaseOverride, () =>
    gameId ? readPhaseOverride(gameId) : null
  )
  const setOverride = useCallback(
    (phase: GamePhase | null) => {
      if (gameId) writePhaseOverride(gameId, phase)
    },
    [gameId]
  )
  return [override, setOverride] as const
}
