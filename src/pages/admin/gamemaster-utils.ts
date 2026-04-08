import type { Game, Player } from '@/db'
import type { SerializedGameState } from '@/transport/types'

/**
 * Serialises a Game + player list into the wire format broadcast to players
 * on GAME_STATE events. Pure function — no DB access, easy to test.
 */
export function serialiseGameState(game: Game, players: Player[]): SerializedGameState {
  const scores: Record<string, number> = {}
  for (const p of players) {
    scores[p.id] = p.score
  }

  return {
    gameId: game.id,
    status: game.status,
    currentRoundIdx: game.currentRoundIdx,
    currentQuestionIdx: game.currentQuestionIdx,
    buzzerLocked: game.buzzerLocked,
    showQuestion: game.showQuestion,
    showAnswers: game.showAnswers,
    showMedia: game.showMedia,
    scores,
  }
}

/**
 * Returns true when the lobby "Start game" button should be enabled.
 * Transport must be connected OR soloBypass is on; at least one active
 * player must be present OR soloBypass is on.
 */
export function canStartGame(params: {
  transportStatus: string
  activePlayers: number
  soloBypass: boolean
}): boolean {
  const { transportStatus, activePlayers, soloBypass } = params
  if (soloBypass) return true
  return transportStatus === 'connected' && activePlayers > 0
}

/**
 * Upserts a joining player into a player list, preserving existing score
 * and joinedAt. Returns a new sorted array.
 */
export function upsertPlayer(
  players: Player[],
  incoming: {
    id: string
    gameId: string
    name: string
    teamId: string | null
    deviceId: string
  }
): Player[] {
  const existing = players.find(p => p.id === incoming.id)
  const record: Player = {
    id: incoming.id,
    gameId: incoming.gameId,
    name: incoming.name,
    teamId: incoming.teamId,
    deviceId: incoming.deviceId,
    score: existing?.score ?? 0,
    isAway: false,
    joinedAt: existing?.joinedAt ?? Date.now(),
  }
  const without = players.filter(p => p.id !== incoming.id)
  return [...without, record].sort((a, b) => a.joinedAt - b.joinedAt)
}

/**
 * Marks a player as away in a player list. Returns a new array.
 */
export function markPlayerAway(players: Player[], playerId: string): Player[] {
  return players.map(p => (p.id === playerId ? { ...p, isAway: true } : p))
}
