import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { parseStudio, readStudioRaw, subscribeStudio, writeStudio } from '@/lib/studio'
import type { StudioState } from '@/lib/studio'

/**
 * Studio mode for `gameId` (`null`: off) and a setter. Kept in local storage, so the
 * projector window on the same machine follows the GM's takes too (ADR 0025).
 */
export function useStudio(gameId: string | null) {
  // The raw string is the snapshot: parsing on every read would make a new object each time
  const raw = useSyncExternalStore(subscribeStudio, () => (gameId ? readStudioRaw(gameId) : null))
  const studio = useMemo(() => parseStudio(raw), [raw])
  const setStudio = useCallback(
    (state: StudioState | null) => {
      if (gameId) writeStudio(gameId, state)
    },
    [gameId]
  )
  return [studio, setStudio] as const
}
