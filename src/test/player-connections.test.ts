// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Player, Team } from '@/db'
import { PlayerConnections, resolveJoin } from '@/pages/admin/player-connections'

const JOIN = {
  type: 'JOIN' as const,
  playerName: 'Alice',
  deviceId: 'dev-a',
  teamId: null,
  newTeamName: null,
}

function team(id: string, gameId: string): Team {
  return { id, gameId, name: id, color: '#000', icon: 'Shield', score: 0 }
}

function player(overrides: Partial<Player>): Player {
  return {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    score: 0,
    isAway: true,
    deviceId: 'dev-a',
    joinedAt: 100,
    ...overrides,
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()))
})

describe('PlayerConnections', () => {
  it('maps a connection to its player', () => {
    const c = new PlayerConnections()
    c.bind('dc1', 'p1')
    expect(c.playerFor('dc1')).toBe('p1')
    expect(c.playerFor('dc2')).toBeUndefined()
  })

  it('keeps a player on one connection: rebinding drops the old one', () => {
    const c = new PlayerConnections()
    c.bind('dc1', 'p1')
    c.bind('dc2', 'p1')
    expect(c.playerFor('dc1')).toBeUndefined()
    expect(c.playerFor('dc2')).toBe('p1')
  })

  it('unbindConnection returns the player and forgets the connection', () => {
    const c = new PlayerConnections()
    c.bind('dc1', 'p1')
    expect(c.unbindConnection('dc1')).toBe('p1')
    expect(c.playerFor('dc1')).toBeUndefined()
    expect(c.unbindConnection('dc1')).toBeUndefined()
  })

  it('unbindPlayer removes the player from every connection (kick)', () => {
    const c = new PlayerConnections()
    c.bind('dc1', 'p1')
    c.bind('dc2', 'p2')
    c.unbindPlayer('p1')
    expect(c.playerFor('dc1')).toBeUndefined()
    expect(c.playerFor('dc2')).toBe('p2')
  })
})

describe('resolveJoin', () => {
  it('assigns a new host-side id to a new device', async () => {
    const a = await resolveJoin('g1', JOIN)
    const b = await resolveJoin('g1', { ...JOIN, deviceId: 'dev-b' })
    expect(a.id).toBeTruthy()
    expect(a.id).not.toBe(b.id)
    expect(a).toMatchObject({ gameId: 'g1', name: 'Alice', teamId: null, score: 0, isAway: false })
  })

  it('matches a rejoin by deviceId and keeps id, score, team and join time', async () => {
    await db.teams.add(team('t1', 'g1'))
    await db.players.add(player({ score: 30, teamId: 't1' }))

    const rejoin = await resolveJoin('g1', { ...JOIN, playerName: 'Alice 2' })
    expect(rejoin).toMatchObject({
      id: 'p1',
      name: 'Alice 2',
      score: 30,
      teamId: 't1',
      joinedAt: 100,
      isAway: false,
    })
  })

  it('does not match a device from another game', async () => {
    await db.players.add(player({ gameId: 'g2' }))
    const joined = await resolveJoin('g1', JOIN)
    expect(joined.id).not.toBe('p1')
  })

  it('accepts a team from this game', async () => {
    await db.teams.add(team('t1', 'g1'))
    expect((await resolveJoin('g1', { ...JOIN, teamId: 't1' })).teamId).toBe('t1')
  })

  it('ignores a team from another game or an unknown team', async () => {
    await db.teams.add(team('t2', 'g2'))
    expect((await resolveJoin('g1', { ...JOIN, teamId: 't2' })).teamId).toBeNull()
    expect((await resolveJoin('g1', { ...JOIN, teamId: 'nope' })).teamId).toBeNull()
  })
})
