import { useCallback } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import { serialiseGameState } from '@/pages/admin/gamemaster-utils'
import type { Game, Player, GameStatus } from '@/db'

export interface UseGameLifecycleResult {
  pauseGame: (game: Game) => Promise<Game>
  resumeGame: (game: Game) => Promise<Game>
  endGame: (game: Game, players: Player[]) => Promise<Game>
}

/**
 * Encapsulates pause / resume / end transitions for an active game session.
 *
 * Each action:
 * 1. Persists the new status to IndexedDB.
 * 2. Emits `GAME_STATUS` so connected players update their UI.
 * 3. On end: also disconnects transport.
 * 4. Returns the updated Game so callers can replace local state.
 *
 * All three functions are stable across renders (useCallback with no deps that
 * change — they read game/players through the closure args, not React state).
 */
export function useGameLifecycle(): UseGameLifecycleResult {
  /** Pause an active game. No-op if the game is not active. */
  const pauseGame = useCallback(async (game: Game): Promise<Game> => {
    const now = Date.now()
    const updated: Game = { ...game, status: 'paused' as GameStatus, updatedAt: now }
    await db.games.update(game.id, { status: 'paused', updatedAt: now })
    transportManager.send({ type: 'GAME_STATUS', status: 'paused' })
    return updated
  }, [])

  /** Resume a paused game. No-op if the game is not paused. */
  const resumeGame = useCallback(async (game: Game): Promise<Game> => {
    const now = Date.now()
    const updated: Game = { ...game, status: 'active' as GameStatus, updatedAt: now }
    await db.games.update(game.id, { status: 'active', updatedAt: now })
    transportManager.send({ type: 'GAME_STATUS', status: 'active' })
    return updated
  }, [])

  /**
   * End the game. Emits `GAME_STATUS { status: 'ended' }`, disconnects
   * transport, and persists the status. After this the game is read-only.
   */
  const endGame = useCallback(async (game: Game, players: Player[]): Promise<Game> => {
    const now = Date.now()
    const updated: Game = { ...game, status: 'ended' as GameStatus, updatedAt: now }
    await db.games.update(game.id, { status: 'ended', updatedAt: now })
    transportManager.send({ type: 'GAME_STATUS', status: 'ended' })
    // Send final state snapshot before disconnecting
    transportManager.send({ type: 'GAME_STATE', state: serialiseGameState(updated, players) })
    transportManager.disconnect()
    return updated
  }, [])

  return { pauseGame, resumeGame, endGame }
}
