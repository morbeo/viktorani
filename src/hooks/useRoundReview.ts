import { useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  parseRoundReview,
  readRoundReview,
  subscribeRoundReview,
  writeRoundReview,
} from '@/lib/round-review'
import type { RoundReview } from '@/lib/round-review'

/** The open end-of-round review of `gameId`, and a setter that opens or closes it. */
export function useRoundReview(gameId: string | null) {
  const stored = useSyncExternalStore(subscribeRoundReview, () =>
    gameId ? readRoundReview(gameId) : null
  )
  const review = useMemo(() => parseRoundReview(stored), [stored])
  const setReview = useCallback(
    (next: RoundReview | null) => {
      if (gameId) writeRoundReview(gameId, next)
    },
    [gameId]
  )
  return [review, setReview] as const
}
