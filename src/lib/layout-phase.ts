import { GAME_PHASES } from '@/db'
import type { BuzzEvent, GamePhase, GameStatus } from '@/db'

/**
 * Which phase layouts are picked for (#414): worked out from the game's state, unless the
 * game master has chosen one by hand.
 */

/**
 * The phase the game is in, from its status and the buzzes on the question shown.
 *
 * @remarks
 * Ended and not-yet-started games are `ended` and `lobby`. Otherwise a correct ruling on
 * the question means its answer is out (`reveal`); a buzz the GM hasn't ruled on yet (not
 * a false start) is `buzzed`; anything else is `question`. `scoreboard` only comes from the
 * GM's override.
 */
export function autoPhase(
  status: GameStatus,
  buzzes: readonly Pick<BuzzEvent, 'gmDecision' | 'isFalseStart'>[]
): GamePhase {
  if (status === 'ended') return 'ended'
  if (status === 'waiting') return 'lobby'
  if (buzzes.some(b => b.gmDecision === 'Correct')) return 'reveal'
  if (buzzes.some(b => b.gmDecision === null && !b.isFalseStart)) return 'buzzed'
  return 'question'
}

/**
 * The phase layouts are picked for: the GM's override while the game is running, the
 * game's own phase before it starts and after it ends.
 */
export function effectivePhase(auto: GamePhase, override: GamePhase | null): GamePhase {
  return auto === 'lobby' || auto === 'ended' ? auto : (override ?? auto)
}

const overrideKey = (gameId: string) => `viktorani:layout-phase:${gameId}`

/** The GM's chosen phase for `gameId`, or `null` to follow the game. */
export function readPhaseOverride(gameId: string): GamePhase | null {
  try {
    const stored = localStorage.getItem(overrideKey(gameId))
    return GAME_PHASES.find(p => p === stored) ?? null
  } catch {
    return null
  }
}

const listeners = new Set<() => void>()

/** Choose a phase for `gameId` by hand, or `null` to go back to following the game. */
export function writePhaseOverride(gameId: string, phase: GamePhase | null): void {
  try {
    if (phase) localStorage.setItem(overrideKey(gameId), phase)
    else localStorage.removeItem(overrideKey(gameId))
  } catch {
    // Storage unavailable: the choice can't be kept
  }
  for (const listener of listeners) listener()
}

/** Call `listener` when the override changes, in this window or another on this machine. */
export function subscribePhaseOverride(listener: () => void): () => void {
  listeners.add(listener)
  // Another window on this machine (the projector view) changed it
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}
