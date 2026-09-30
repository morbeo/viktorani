import { db } from '@/db'
import type { Player } from '@/db'
import type { PlayerEvent } from '@/transport/types'

type JoinEvent = Extract<PlayerEvent, { type: 'JOIN' }>

/**
 * Host-side map from transport connection to player.
 *
 * @remarks
 * Players never send their own id: the host binds a connection to a player on
 * JOIN, and every later event from that connection acts as that player only.
 * A player is bound to at most one connection — a rejoin from a new connection
 * replaces the old binding.
 */
export class PlayerConnections {
  private byConn = new Map<string, string>()

  /** Bind `connId` to `playerId`, dropping any other connection bound to the player. */
  bind(connId: string, playerId: string) {
    this.unbindPlayer(playerId)
    this.byConn.set(connId, playerId)
  }

  /** The player bound to `connId`, or `undefined` if it hasn't joined. */
  playerFor(connId: string): string | undefined {
    return this.byConn.get(connId)
  }

  /** Remove the binding for `connId`. Returns the player it was bound to, if any. */
  unbindConnection(connId: string): string | undefined {
    const playerId = this.byConn.get(connId)
    this.byConn.delete(connId)
    return playerId
  }

  /** Remove every connection bound to `playerId` (e.g. on kick). */
  unbindPlayer(playerId: string) {
    for (const [connId, id] of this.byConn) {
      if (id === playerId) this.byConn.delete(connId)
    }
  }
}

/**
 * Build the player record for a JOIN. The host assigns the id: a rejoin is matched
 * by `deviceId` within the game and keeps its id, score, team and join time.
 * `teamId` is accepted only if that team belongs to this game.
 *
 * @remarks
 * `newTeamName` is not handled yet: player-created teams depend on the
 * `allowPlayerTeams` game setting (#267, enforced in #272).
 */
export async function resolveJoin(gameId: string, join: JoinEvent): Promise<Player> {
  const existing = await db.players
    .where('gameId')
    .equals(gameId)
    .filter(p => p.deviceId === join.deviceId)
    .first()
  const team = join.teamId ? await db.teams.get(join.teamId) : undefined
  const teamId = team?.gameId === gameId ? team.id : (existing?.teamId ?? null)

  return {
    id: existing?.id ?? crypto.randomUUID(),
    gameId,
    name: join.playerName,
    teamId,
    deviceId: join.deviceId,
    score: existing?.score ?? 0,
    isAway: false,
    joinedAt: existing?.joinedAt ?? Date.now(),
  }
}
