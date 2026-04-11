// @vitest-pool vmForks
// Tests for ManagedPlayer / ManagedTeam / ManagedLabel model shapes,
// plus the atomic addPlayerToTeam / removePlayerFromTeam helpers.
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/db'
import type { ManagedPlayer, ManagedTeam, ManagedLabel } from '@/types/players-teams'
import { addPlayerToTeam, removePlayerFromTeam, seedPlayersTeams } from '@/db/players-teams'

// ── Model shape ───────────────────────────────────────────────────────────────

describe('ManagedPlayer model shape', () => {
  beforeEach(async () => {
    await db.managedPlayers.clear()
  })

  it('stores and retrieves a full ManagedPlayer record', async () => {
    const player: ManagedPlayer = {
      id: crypto.randomUUID(),
      name: 'Ana Kovac',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedPlayers.add(player)
    const retrieved = await db.managedPlayers.get(player.id)
    expect(retrieved).toMatchObject({ name: 'Ana Kovac', teamIds: [], archivedAt: null })
  })

  it('stores archivedAt as a Date', async () => {
    const now = new Date()
    const id = crypto.randomUUID()
    await db.managedPlayers.add({
      id,
      name: 'Archived Player',
      teamIds: [],
      labelIds: [],
      archivedAt: now,
      totalScore: 0,
      gameLog: [],
    })
    const record = await db.managedPlayers.get(id)
    expect(record?.archivedAt).toBeInstanceOf(Date)
    expect(record?.archivedAt?.getTime()).toBe(now.getTime())
  })
})

describe('ManagedTeam model shape', () => {
  beforeEach(async () => {
    await db.managedTeams.clear()
  })

  it('stores and retrieves a full ManagedTeam record', async () => {
    const team: ManagedTeam = {
      id: crypto.randomUUID(),
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedTeams.add(team)
    const retrieved = await db.managedTeams.get(team.id)
    expect(retrieved).toMatchObject({ name: 'Blue Shield', icon: 'Shield', playerIds: [] })
  })
})

describe('ManagedLabel model shape', () => {
  beforeEach(async () => {
    await db.managedLabels.clear()
  })

  it('stores and retrieves a ManagedLabel', async () => {
    const label: ManagedLabel = {
      id: crypto.randomUUID(),
      name: 'Trivia',
      color: '#6366f1',
    }
    await db.managedLabels.add(label)
    const retrieved = await db.managedLabels.get(label.id)
    expect(retrieved).toEqual(label)
  })
})

// ── Atomic sync helpers ───────────────────────────────────────────────────────

describe('addPlayerToTeam', () => {
  let playerId: string
  let teamId: string

  beforeEach(async () => {
    await Promise.all([db.managedPlayers.clear(), db.managedTeams.clear()])

    playerId = crypto.randomUUID()
    teamId = crypto.randomUUID()

    await db.managedPlayers.add({
      id: playerId,
      name: 'Test Player',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    await db.managedTeams.add({
      id: teamId,
      name: 'Test Team',
      color: '#000',
      icon: 'Zap',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
  })

  it('adds teamId to player.teamIds and playerId to team.playerIds atomically', async () => {
    await addPlayerToTeam(playerId, teamId)

    const [player, team] = await Promise.all([
      db.managedPlayers.get(playerId),
      db.managedTeams.get(teamId),
    ])
    expect(player?.teamIds).toContain(teamId)
    expect(team?.playerIds).toContain(playerId)
  })

  it('is idempotent when called twice', async () => {
    await addPlayerToTeam(playerId, teamId)
    await addPlayerToTeam(playerId, teamId)

    const [player, team] = await Promise.all([
      db.managedPlayers.get(playerId),
      db.managedTeams.get(teamId),
    ])
    expect(player?.teamIds).toHaveLength(1)
    expect(team?.playerIds).toHaveLength(1)
  })

  it('throws when player does not exist', async () => {
    await expect(addPlayerToTeam('nonexistent', teamId)).rejects.toThrow()
  })
})

describe('removePlayerFromTeam', () => {
  let playerId: string
  let teamId: string

  beforeEach(async () => {
    await Promise.all([db.managedPlayers.clear(), db.managedTeams.clear()])

    playerId = crypto.randomUUID()
    teamId = crypto.randomUUID()

    await db.managedPlayers.add({
      id: playerId,
      name: 'Test Player',
      teamIds: [teamId],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    await db.managedTeams.add({
      id: teamId,
      name: 'Test Team',
      color: '#000',
      icon: 'Zap',
      labelIds: [],
      playerIds: [playerId],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
  })

  it('removes the relationship from both sides atomically', async () => {
    await removePlayerFromTeam(playerId, teamId)

    const [player, team] = await Promise.all([
      db.managedPlayers.get(playerId),
      db.managedTeams.get(teamId),
    ])
    expect(player?.teamIds).not.toContain(teamId)
    expect(team?.playerIds).not.toContain(playerId)
  })

  it('is a no-op when relationship does not exist', async () => {
    const otherId = crypto.randomUUID()
    await expect(removePlayerFromTeam(playerId, otherId)).resolves.not.toThrow()
  })
})

// ── Seed helper ───────────────────────────────────────────────────────────────

describe('seedPlayersTeams', () => {
  beforeEach(async () => {
    await Promise.all([
      db.managedPlayers.clear(),
      db.managedTeams.clear(),
      db.managedLabels.clear(),
    ])
  })

  it('creates 3 labels, 2 teams, and 4 players', async () => {
    await seedPlayersTeams()
    const [labels, teams, players] = await Promise.all([
      db.managedLabels.count(),
      db.managedTeams.count(),
      db.managedPlayers.count(),
    ])
    expect(labels).toBe(3)
    expect(teams).toBe(2)
    expect(players).toBe(4)
  })

  it('is idempotent — does not insert again if data exists', async () => {
    await seedPlayersTeams()
    await seedPlayersTeams()
    const count = await db.managedPlayers.count()
    expect(count).toBe(4)
  })

  it('creates consistent bidirectional player<->team relationships', async () => {
    await seedPlayersTeams()
    const teams = await db.managedTeams.toArray()
    for (const team of teams) {
      for (const pid of team.playerIds) {
        const player = await db.managedPlayers.get(pid)
        expect(player?.teamIds).toContain(team.id)
      }
    }
  })
})
