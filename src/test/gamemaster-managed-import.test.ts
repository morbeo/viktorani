// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import type { ManagedPlayer, ManagedTeam, Team } from '@/db'
import { buildManagedImport } from '@/pages/admin/gamemaster-utils'

function managedTeam(overrides: Partial<ManagedTeam> = {}): ManagedTeam {
  return {
    id: 'mt1',
    name: 'Reds',
    color: '#f00',
    icon: 'Shield',
    labelIds: [],
    playerIds: [],
    archivedAt: null,
    totalScore: 0,
    gameLog: [],
    ...overrides,
  }
}

function managedPlayer(overrides: Partial<ManagedPlayer> = {}): ManagedPlayer {
  return {
    id: 'mp1',
    name: 'Alice',
    teamIds: [],
    labelIds: [],
    archivedAt: null,
    totalScore: 0,
    gameLog: [],
    ...overrides,
  }
}

// A deterministic id generator so assertions are stable
function seqId() {
  let n = 0
  return () => `id-${++n}`
}

describe('buildManagedImport', () => {
  it('mints fresh ids rather than reusing managed ids', () => {
    const { newTeams, newPlayers } = buildManagedImport({
      managedTeams: [managedTeam({ id: 'mt1' })],
      managedPlayers: [managedPlayer({ id: 'mp1', teamIds: ['mt1'] })],
      existingTeams: [],
      existingPlayerNames: [],
      gameId: 'g1',
      now: 1000,
      newId: seqId(),
    })

    expect(newTeams[0].id).not.toBe('mt1')
    expect(newPlayers[0].id).not.toBe('mp1')
    expect(newTeams[0].gameId).toBe('g1')
    expect(newPlayers[0].gameId).toBe('g1')
  })

  it('produces different ids when importing the same roster into a second game', () => {
    const managedTeams = [managedTeam({ id: 'mt1' })]
    const managedPlayers = [managedPlayer({ id: 'mp1', teamIds: ['mt1'] })]

    const first = buildManagedImport({
      managedTeams,
      managedPlayers,
      existingTeams: [],
      existingPlayerNames: [],
      gameId: 'g1',
      now: 0,
      newId: seqId(),
    })
    const second = buildManagedImport({
      managedTeams,
      managedPlayers,
      existingTeams: [],
      existingPlayerNames: [],
      gameId: 'g2',
      now: 0,
      newId: seqId(),
    })

    // No id collisions across games — this is what used to fail on the second import
    expect(first.newTeams[0].id).not.toBe(second.newTeams[0].id)
    expect(first.newPlayers[0].id).not.toBe(second.newPlayers[0].id)
    expect(second.newTeams[0].gameId).toBe('g2')
  })

  it('places a player on the session team matching its managed team name', () => {
    const { newTeams, newPlayers } = buildManagedImport({
      managedTeams: [managedTeam({ id: 'mt1', name: 'Reds' })],
      managedPlayers: [managedPlayer({ id: 'mp1', teamIds: ['mt1'] })],
      existingTeams: [],
      existingPlayerNames: [],
      gameId: 'g1',
      now: 0,
      newId: seqId(),
    })

    expect(newPlayers[0].teamId).toBe(newTeams[0].id)
  })

  it('reuses an existing session team with the same name', () => {
    const existing: Pick<Team, 'id' | 'name'> = { id: 'existing-team', name: 'Reds' }
    const { newTeams, newPlayers } = buildManagedImport({
      managedTeams: [managedTeam({ id: 'mt1', name: 'Reds' })],
      managedPlayers: [managedPlayer({ id: 'mp1', teamIds: ['mt1'] })],
      existingTeams: [existing],
      existingPlayerNames: [],
      gameId: 'g1',
      now: 0,
      newId: seqId(),
    })

    expect(newTeams).toHaveLength(0)
    expect(newPlayers[0].teamId).toBe('existing-team')
  })

  it('skips players whose name is already in the session', () => {
    const { newPlayers } = buildManagedImport({
      managedTeams: [],
      managedPlayers: [managedPlayer({ name: 'Alice' }), managedPlayer({ id: 'mp2', name: 'Bob' })],
      existingTeams: [],
      existingPlayerNames: ['Alice'],
      gameId: 'g1',
      now: 0,
      newId: seqId(),
    })

    expect(newPlayers.map(p => p.name)).toEqual(['Bob'])
  })

  it('leaves teamId null when the player has no matching managed team', () => {
    const { newPlayers } = buildManagedImport({
      managedTeams: [],
      managedPlayers: [managedPlayer({ teamIds: ['gone'] })],
      existingTeams: [],
      existingPlayerNames: [],
      gameId: 'g1',
      now: 0,
      newId: seqId(),
    })

    expect(newPlayers[0].teamId).toBeNull()
  })
})
