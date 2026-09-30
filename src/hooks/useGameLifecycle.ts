import { useCallback } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import { serialiseGameState } from '@/pages/admin/gamemaster-utils'
import type { Game, Player } from '@/db'

/** The fields a lifecycle transition changes; merge it into the current game state. */
export type GameStatusPatch = Pick<Game, 'status' | 'updatedAt'>

export interface UseGameLifecycleResult {
  pauseGame: (game: Game) => Promise<GameStatusPatch>
  resumeGame: (game: Game) => Promise<GameStatusPatch>
  endGame: (game: Game, players: Player[]) => Promise<GameStatusPatch>
}

/**
 * Encapsulates pause / resume / end transitions for an active game session.
 *
 * Each action:
 * 1. Persists the new status to IndexedDB.
 * 2. Emits `GAME_STATUS` so connected players update their UI.
 * 3. On end: also disconnects transport.
 * 4. Returns a patch of the changed fields. Callers merge it into their current game
 *    state (not the game they passed in) so overlapping updates, such as a buzzer lock
 *    toggled while the write is in flight, are not reverted.
 *
 * All three functions are stable across renders (useCallback with no deps that
 * change — they read game/players through the closure args, not React state).
 */
export function useGameLifecycle(): UseGameLifecycleResult {
  /** Pause an active game. No-op if the game is not active. */
  const pauseGame = useCallback(async (game: Game): Promise<GameStatusPatch> => {
    const patch: GameStatusPatch = { status: 'paused', updatedAt: Date.now() }
    await db.games.update(game.id, patch)
    transportManager.send({ type: 'GAME_STATUS', status: 'paused' })
    return patch
  }, [])

  /** Resume a paused game. No-op if the game is not paused. */
  const resumeGame = useCallback(async (game: Game): Promise<GameStatusPatch> => {
    const patch: GameStatusPatch = { status: 'active', updatedAt: Date.now() }
    await db.games.update(game.id, patch)
    transportManager.send({ type: 'GAME_STATUS', status: 'active' })
    return patch
  }, [])

  /**
   * End the game. Emits `GAME_STATUS { status: 'ended' }`, disconnects
   * transport, and persists the status. After this the game is read-only.
   */
  const endGame = useCallback(async (game: Game, players: Player[]): Promise<GameStatusPatch> => {
    const patch: GameStatusPatch = { status: 'ended', updatedAt: Date.now() }
    await db.games.update(game.id, patch)
    transportManager.send({ type: 'GAME_STATUS', status: 'ended' })
    // Send final state snapshot before disconnecting
    transportManager.send({
      type: 'GAME_STATE',
      state: serialiseGameState({ ...game, ...patch }, players),
    })
    transportManager.disconnect()
    return patch
  }, [])

  return { pauseGame, resumeGame, endGame }
}
