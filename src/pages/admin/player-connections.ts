import { db } from '@/db'
import type { Game, Player, Team } from '@/db'
import type { PlayerEvent } from '@/transport/types'
import { MAX_LOBBY_TEAMS } from '@/transport/messages'

type JoinEvent = Extract<PlayerEvent, { type: 'JOIN' }>

/** A JOIN waiting for the host's approval, with the connection it arrived on. */
export interface PendingJoin {
  connId: string
  join: JoinEvent
}

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

  /** Every connection bound to a player, i.e. the admitted players' connections. */
  connections(): string[] {
    return [...this.byConn.keys()]
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

/** Colours given to teams players create themselves, in creation order. */
const PLAYER_TEAM_COLORS = ['#e74c3c', '#2ecc71', '#3a57b7', '#f1c40f', '#8e44ad', '#1abc9c']

/**
 * Outcome of a JOIN under the game's join policy. An accepted join carries the player
 * record to save and, when the player asked for a new team, the team to create first.
 * `rejoin` is `true` when the device's earlier player record was restored.
 */
export type JoinResult =
  | { status: 'accepted'; player: Player; newTeam: Team | null; rejoin: boolean }
  | { status: 'rejected'; reason: string }

/**
 * Apply the game's join policy to a JOIN and build the player record. The host assigns
 * the id.
 *
 * @remarks
 * - With `allowRejoin`, a device seen before in this game gets its earlier record back
 *   (id, score, team, join time) and skips the late join check. Without it the device
 *   joins as a new player. An empty `deviceId` (players imported by the host have one)
 *   never matches.
 * - New players are refused once the game has started unless `allowLateJoin` is on.
 * - `teamId` must name a team of this game with room left (`maxPerTeam`); `newTeamName`
 *   needs `allowPlayerTeams` and room for another team (`maxTeams`, and never more than
 *   `MAX_LOBBY_TEAMS`), and joins an existing team of the same name. Joining without a
 *   team needs `allowIndividual`.
 * - `requireApproval` is not checked here: the caller queues accepted new players.
 *
 * The caller must handle one JOIN at a time and save the result before resolving the
 * next, or concurrent joins could exceed the team limits.
 */
export async function resolveJoin(game: Game, join: JoinEvent): Promise<JoinResult> {
  const [players, teams] = await Promise.all([
    db.players.where('gameId').equals(game.id).toArray(),
    db.teams.where('gameId').equals(game.id).toArray(),
  ])
  // Imported players have an empty deviceId; never let a JOIN claim them
  const sameDevice = join.deviceId ? players.filter(p => p.deviceId === join.deviceId) : []
  const previous = sameDevice.sort((a, b) => b.joinedAt - a.joinedAt)[0]
  const existing = game.allowRejoin ? previous : undefined

  if (!existing && game.status !== 'waiting' && !game.allowLateJoin) {
    return { status: 'rejected', reason: 'The game has already started' }
  }

  let teamId: string | null = null
  let newTeam: Team | null = null
  if (join.newTeamName) {
    const wanted = join.newTeamName.trim().toLowerCase()
    const sameName = teams.find(t => t.name.trim().toLowerCase() === wanted)
    if (!game.allowPlayerTeams) {
      return { status: 'rejected', reason: 'Players cannot create teams in this game' }
    }
    if (sameName) {
      teamId = sameName.id
    } else if (teams.length >= (game.maxTeams > 0 ? game.maxTeams : MAX_LOBBY_TEAMS)) {
      return { status: 'rejected', reason: 'No more teams can be created' }
    } else {
      newTeam = {
        id: crypto.randomUUID(),
        gameId: game.id,
        name: join.newTeamName.trim(),
        color: PLAYER_TEAM_COLORS[teams.length % PLAYER_TEAM_COLORS.length],
        icon: 'Shield',
        score: 0,
      }
      teamId = newTeam.id
    }
  } else if (join.teamId) {
    if (!teams.some(t => t.id === join.teamId)) {
      return { status: 'rejected', reason: 'That team is not in this game' }
    }
    teamId = join.teamId
  } else {
    teamId = existing?.teamId ?? null
  }

  if (teamId && !newTeam && teamId !== existing?.teamId && game.maxPerTeam > 0) {
    const members = players.filter(p => p.teamId === teamId && p.id !== existing?.id)
    if (members.length >= game.maxPerTeam) {
      return { status: 'rejected', reason: 'That team is full' }
    }
  }
  if (!teamId && !game.allowIndividual) {
    return { status: 'rejected', reason: 'Pick a team to join' }
  }

  return {
    status: 'accepted',
    player: {
      id: existing?.id ?? crypto.randomUUID(),
      gameId: game.id,
      name: join.playerName,
      teamId,
      deviceId: join.deviceId,
      score: existing?.score ?? 0,
      isAway: false,
      joinedAt: existing?.joinedAt ?? Date.now(),
    },
    newTeam,
    rejoin: !!existing,
  }
}
