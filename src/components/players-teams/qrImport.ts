/**
 * QR import logic for the BYOP flow (issue #116).
 *
 * All functions are pure / async-pure so they are easy to unit-test
 * without rendering React components.
 */
import { db } from '@/db'
import type { ManagedPlayer, PlayerQrPayload, TeamQrPayload } from '@/types/players-teams'
import { addPlayerToTeam } from '@/db/players-teams'

// ── Conflict types ────────────────────────────────────────────────────────────

export interface PlayerFieldDiff {
  field: 'name' | 'labels'
  current: string
  incoming: string
}

export interface PlayerConflict {
  existing: ManagedPlayer
  incoming: PlayerQrPayload
  diffs: PlayerFieldDiff[]
}

export interface MergeChoice {
  /** 'current' keeps the local value; 'incoming' uses the QR value. */
  name: 'current' | 'incoming'
  labels: 'current' | 'incoming'
}

// ── Label resolution ──────────────────────────────────────────────────────────

/**
 * Resolve label names to IDs, creating labels that don't exist yet.
 * Returns the final array of label IDs.
 */
export async function resolveOrCreateLabels(names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const all = await db.managedLabels.toArray()
  const ids: string[] = []
  for (const name of names) {
    const existing = all.find(l => l.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      ids.push(existing.id)
    } else {
      const id = crypto.randomUUID()
      await db.managedLabels.add({ id, name, color: '#6366f1' })
      ids.push(id)
    }
  }
  return ids
}

// ── Player import ─────────────────────────────────────────────────────────────

/**
 * Check whether an incoming player QR conflicts with any existing record.
 * A conflict is an ID match or a name match (case-insensitive).
 * Returns null if no conflict.
 */
export async function detectPlayerConflict(
  incoming: PlayerQrPayload
): Promise<PlayerConflict | null> {
  const [byId, byName] = await Promise.all([
    db.managedPlayers.get(incoming.id),
    db.managedPlayers.filter(p => p.name.toLowerCase() === incoming.name.toLowerCase()).first(),
  ])
  const existing = byId ?? byName ?? null
  if (!existing) return null

  const diffs: PlayerFieldDiff[] = []

  if (existing.name !== incoming.name) {
    diffs.push({ field: 'name', current: existing.name, incoming: incoming.name })
  }

  // Compare label names
  const existingLabelNames = await db.managedLabels
    .where('id')
    .anyOf(existing.labelIds)
    .toArray()
    .then(ls =>
      ls
        .map(l => l.name)
        .sort()
        .join(', ')
    )
  const incomingLabelNames = [...incoming.labels].sort().join(', ')
  if (existingLabelNames !== incomingLabelNames) {
    diffs.push({ field: 'labels', current: existingLabelNames, incoming: incomingLabelNames })
  }

  return { existing, incoming, diffs }
}

/**
 * Directly import a player QR with no conflict — creates a new record.
 * Returns the new player's ID.
 */
export async function importPlayerDirect(incoming: PlayerQrPayload): Promise<string> {
  const labelIds = await resolveOrCreateLabels(incoming.labels)
  const id = incoming.id
  await db.managedPlayers.add({
    id,
    name: incoming.name,
    teamIds: [],
    labelIds,
    archivedAt: null,
    totalScore: 0,
    gameLog: [],
  })
  return id
}

/**
 * Apply a user-chosen merge to an existing player record.
 * Returns the (unchanged) existing player's ID.
 */
export async function applyPlayerMerge(
  conflict: PlayerConflict,
  choices: MergeChoice
): Promise<string> {
  const updates: Partial<Pick<ManagedPlayer, 'name' | 'labelIds'>> = {}

  if (choices.name === 'incoming') {
    updates.name = conflict.incoming.name
  }

  if (choices.labels === 'incoming') {
    updates.labelIds = await resolveOrCreateLabels(conflict.incoming.labels)
  }

  if (Object.keys(updates).length > 0) {
    await db.managedPlayers.update(conflict.existing.id, updates)
  }

  return conflict.existing.id
}

// ── Team import ───────────────────────────────────────────────────────────────

export interface TeamImportResult {
  teamId: string
  /** IDs of players that were newly created. */
  createdPlayerIds: string[]
  /** IDs of players that had conflicts requiring manual merge. */
  conflictedPlayerIds: string[]
  /** Conflicts that need to be resolved by the user (one per conflicting player). */
  pendingConflicts: PlayerConflict[]
}

/**
 * Import a Team QR payload.
 * - Creates the team if it doesn't exist; updates name/color/icon if it does.
 * - For each embedded player: detects conflicts and either imports directly
 *   or queues for the merge UI.
 * - Returns a result object so the caller can drive the merge UI loop.
 */
export async function importTeamQr(incoming: TeamQrPayload): Promise<TeamImportResult> {
  const labelIds = await resolveOrCreateLabels(incoming.labels)

  // Upsert team
  const existingTeam = await db.managedTeams.get(incoming.id)
  let teamId: string
  if (existingTeam) {
    await db.managedTeams.update(incoming.id, {
      name: incoming.name,
      color: incoming.color,
      icon: incoming.icon,
      labelIds,
    })
    teamId = incoming.id
  } else {
    teamId = incoming.id
    await db.managedTeams.add({
      id: teamId,
      name: incoming.name,
      color: incoming.color,
      icon: incoming.icon,
      labelIds,
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
  }

  const createdPlayerIds: string[] = []
  const conflictedPlayerIds: string[] = []
  const pendingConflicts: PlayerConflict[] = []

  for (const stub of incoming.players) {
    const stubPayload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: stub.id,
      name: stub.name,
      labels: [],
    }
    const conflict = await detectPlayerConflict(stubPayload)
    if (conflict) {
      conflictedPlayerIds.push(conflict.existing.id)
      pendingConflicts.push(conflict)
    } else {
      const playerId = await importPlayerDirect(stubPayload)
      await addPlayerToTeam(playerId, teamId)
      createdPlayerIds.push(playerId)
    }
  }

  // Add all non-conflicting players to the team
  for (const pid of createdPlayerIds) {
    const player = await db.managedPlayers.get(pid)
    if (player && !player.teamIds.includes(teamId)) {
      await addPlayerToTeam(pid, teamId)
    }
  }

  return { teamId, createdPlayerIds, conflictedPlayerIds, pendingConflicts }
}
