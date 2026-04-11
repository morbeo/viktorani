/**
 * Atomic helpers for the bidirectional ManagedPlayer <-> ManagedTeam relationship,
 * and dev/test seed fixtures.
 *
 * All writes go through a single Dexie transaction so the two sides of the
 * many-to-many join never diverge — even if the tab closes mid-write.
 */
import { db } from '@/db'

// ── Relationship sync ─────────────────────────────────────────────────────────

/**
 * Add `playerId` to `team.playerIds` AND `teamId` to `player.teamIds`
 * in a single atomic transaction.
 *
 * Safe to call when the relationship already exists — idempotent.
 */
export async function addPlayerToTeam(playerId: string, teamId: string): Promise<void> {
  await db.transaction('rw', [db.managedPlayers, db.managedTeams], async () => {
    const [player, team] = await Promise.all([
      db.managedPlayers.get(playerId),
      db.managedTeams.get(teamId),
    ])
    if (!player || !team) throw new Error('Player or team not found')

    const newTeamIds = player.teamIds.includes(teamId)
      ? player.teamIds
      : [...player.teamIds, teamId]

    const newPlayerIds = team.playerIds.includes(playerId)
      ? team.playerIds
      : [...team.playerIds, playerId]

    await Promise.all([
      db.managedPlayers.update(playerId, { teamIds: newTeamIds }),
      db.managedTeams.update(teamId, { playerIds: newPlayerIds }),
    ])
  })
}

/**
 * Remove `playerId` from `team.playerIds` AND `teamId` from `player.teamIds`
 * in a single atomic transaction.
 *
 * Safe to call when the relationship does not exist — idempotent.
 */
export async function removePlayerFromTeam(playerId: string, teamId: string): Promise<void> {
  await db.transaction('rw', [db.managedPlayers, db.managedTeams], async () => {
    const [player, team] = await Promise.all([
      db.managedPlayers.get(playerId),
      db.managedTeams.get(teamId),
    ])
    if (!player || !team) return // already gone — no-op

    await Promise.all([
      db.managedPlayers.update(playerId, {
        teamIds: player.teamIds.filter(id => id !== teamId),
      }),
      db.managedTeams.update(teamId, {
        playerIds: team.playerIds.filter(id => id !== playerId),
      }),
    ])
  })
}

// ── Dev / test seed ───────────────────────────────────────────────────────────

/**
 * Seed three labels, two teams, and four players for dev and test use.
 *
 * @remarks
 * Idempotent — checks counts before inserting so it is safe to call
 * from tests that share a database instance.
 */
export async function seedPlayersTeams(): Promise<void> {
  const [labelCount, teamCount, playerCount] = await Promise.all([
    db.managedLabels.count(),
    db.managedTeams.count(),
    db.managedPlayers.count(),
  ])

  if (labelCount > 0 || teamCount > 0 || playerCount > 0) return

  const labelTrivia = crypto.randomUUID()
  const labelSports = crypto.randomUUID()
  const labelRegulars = crypto.randomUUID()
  const teamBlue = crypto.randomUUID()
  const teamGreen = crypto.randomUUID()
  const p1 = crypto.randomUUID()
  const p2 = crypto.randomUUID()
  const p3 = crypto.randomUUID()
  const p4 = crypto.randomUUID()

  await db.transaction('rw', [db.managedLabels, db.managedTeams, db.managedPlayers], async () => {
    await db.managedLabels.bulkAdd([
      { id: labelTrivia, name: 'Trivia', color: '#6366f1' },
      { id: labelSports, name: 'Sports', color: '#e67e22' },
      { id: labelRegulars, name: 'Regulars', color: '#27ae60' },
    ])

    await db.managedTeams.bulkAdd([
      {
        id: teamBlue,
        name: 'Blue Shield',
        color: '#3a57b7',
        icon: 'Shield',
        labelIds: [labelTrivia],
        playerIds: [p1, p2],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: teamGreen,
        name: 'Green Sparks',
        color: '#2d7a46',
        icon: 'Zap',
        labelIds: [labelSports],
        playerIds: [p3],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])

    await db.managedPlayers.bulkAdd([
      {
        id: p1,
        name: 'Ana Kovac',
        teamIds: [teamBlue],
        labelIds: [labelTrivia, labelRegulars],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: p2,
        name: 'Ben Tomas',
        teamIds: [teamBlue],
        labelIds: [labelSports],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: p3,
        name: 'Clara M.',
        teamIds: [teamGreen],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: p4,
        name: 'Dave K.',
        teamIds: [],
        labelIds: [labelRegulars],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
  })
}
