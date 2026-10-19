import type { RoundReviewView } from '@/transport/types'

/**
 * The host's end-of-round answer review (ADR 0023): which round is being reviewed and how.
 * Kept per game in local storage, like the layout phase override, so the projector window
 * on the same machine follows it.
 */
export interface RoundReview {
  roundId: string
  view: RoundReviewView
}

const reviewKey = (gameId: string) => `viktorani:round-review:${gameId}`

/** The stored review for `gameId` as written, or `null` when none is open. */
export function readRoundReview(gameId: string): string | null {
  try {
    return localStorage.getItem(reviewKey(gameId))
  } catch {
    return null
  }
}

/** A stored review, or `null` for none or a value that isn't one. */
export function parseRoundReview(stored: string | null): RoundReview | null {
  if (!stored) return null
  try {
    const value: unknown = JSON.parse(stored)
    if (typeof value !== 'object' || value === null) return null
    const { roundId, view } = value as Record<string, unknown>
    if (typeof roundId !== 'string' || (view !== 'list' && view !== 'table')) return null
    return { roundId, view }
  } catch {
    return null
  }
}

const listeners = new Set<() => void>()

/** Open a review for `gameId`, or `null` to close it. */
export function writeRoundReview(gameId: string, review: RoundReview | null): void {
  try {
    if (review) localStorage.setItem(reviewKey(gameId), JSON.stringify(review))
    else localStorage.removeItem(reviewKey(gameId))
  } catch {
    // Storage unavailable: the projector window won't follow the review
  }
  for (const listener of listeners) listener()
}

/** Call `listener` when a review opens or closes, in this window or another on this machine. */
export function subscribeRoundReview(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}
