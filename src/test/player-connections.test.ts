// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Game, Player, Team } from '@/db'
import type { PlayerEvent } from '@/transport/types'
import { PlayerConnections, resolveJoin } from '@/pages/admin/player-connections'
import { MAX_LOBBY_TEAMS } from '@/transport/messages'

const JOIN: Extract<PlayerEvent, { type: 'JOIN' }> = {
  type: 'JOIN',
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

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'G',
    status: 'waiting',
    roomId: 'ROOM01',
    scoringEnabled: true,
    showQuestion: true,
    showAnswers: false,
    showMedia: true,
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    allowLateJoin: true,
    allowRejoin: true,
    requireApproval: false,
    allowPlayerTeams: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: true,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

async function accepted(g: Game, join: typeof JOIN) {
  const result = await resolveJoin(g, join)
  if (result.status !== 'accepted') throw new Error(`rejected: ${result.reason}`)
  return result
}

async function rejection(g: Game, join: typeof JOIN) {
  const result = await resolveJoin(g, join)
  return result.status === 'rejected' ? result.reason : null
}

describe('resolveJoin', () => {
  it('assigns a new host-side id to a new device', async () => {
    const a = await accepted(game(), JOIN)
    const b = await accepted(game(), { ...JOIN, deviceId: 'dev-b' })
    expect(a.player.id).toBeTruthy()
    expect(a.player.id).not.toBe(b.player.id)
    expect(a.player).toMatchObject({ gameId: 'g1', name: 'Alice', teamId: null, score: 0 })
    expect(a.rejoin).toBe(false)
  })

  it('matches a rejoin by deviceId and keeps id, score, team and join time', async () => {
    await db.teams.add(team('t1', 'g1'))
    await db.players.add(player({ score: 30, teamId: 't1' }))

    const rejoin = await accepted(game(), { ...JOIN, playerName: 'Alice 2' })
    expect(rejoin.rejoin).toBe(true)
    expect(rejoin.player).toMatchObject({
      id: 'p1',
      name: 'Alice 2',
      score: 30,
      teamId: 't1',
      joinedAt: 100,
      isAway: false,
    })
  })

  it('treats a known device as a new player when rejoin is off', async () => {
    await db.players.add(player({ score: 30 }))
    const joined = await accepted(game({ allowRejoin: false }), JOIN)
    expect(joined.rejoin).toBe(false)
    expect(joined.player.id).not.toBe('p1')
    expect(joined.player.score).toBe(0)
  })

  it('never matches an empty deviceId to a player imported by the host', async () => {
    await db.players.add(player({ deviceId: '', score: 30 }))
    const joined = await accepted(game({ requireApproval: true }), { ...JOIN, deviceId: '' })
    expect(joined.rejoin).toBe(false)
    expect(joined.player.id).not.toBe('p1')
  })

  it('does not match a device from another game', async () => {
    await db.players.add(player({ gameId: 'g2' }))
    expect((await accepted(game(), JOIN)).player.id).not.toBe('p1')
  })

  it('refuses new players after the start unless late join is on', async () => {
    expect(await rejection(game({ status: 'active', allowLateJoin: false }), JOIN)).toBe(
      'The game has already started'
    )
    expect(await rejection(game({ status: 'active' }), JOIN)).toBeNull()
    expect(await rejection(game({ allowLateJoin: false }), JOIN)).toBeNull()
  })

  it('lets a known device rejoin after the start even without late join', async () => {
    await db.players.add(player({}))
    const g = game({ status: 'paused', allowLateJoin: false })
    expect((await accepted(g, JOIN)).player.id).toBe('p1')
    expect(await rejection({ ...g, allowRejoin: false }, JOIN)).toBe(
      'The game has already started'
    )
  })

  it('accepts a team from this game and refuses others', async () => {
    await db.teams.bulkAdd([team('t1', 'g1'), team('t2', 'g2')])
    expect((await accepted(game(), { ...JOIN, teamId: 't1' })).player.teamId).toBe('t1')
    expect(await rejection(game(), { ...JOIN, teamId: 't2' })).toBe(
      'That team is not in this game'
    )
    expect(await rejection(game(), { ...JOIN, teamId: 'nope' })).toBe(
      'That team is not in this game'
    )
  })

  it('refuses a full team but lets its own member rejoin', async () => {
    await db.teams.add(team('t1', 'g1'))
    await db.players.add(player({ id: 'p2', deviceId: 'dev-b', teamId: 't1' }))
    const g = game({ maxPerTeam: 1 })
    expect(await rejection(g, { ...JOIN, teamId: 't1' })).toBe('That team is full')
    expect(await rejection(g, { ...JOIN, deviceId: 'dev-b', teamId: 't1' })).toBeNull()
  })

  it('creates a player team only when allowed and within the team limit', async () => {
    const join = { ...JOIN, newTeamName: ' Owls ' }
    const created = await accepted(game(), join)
    expect(created.newTeam).toMatchObject({ gameId: 'g1', name: 'Owls', score: 0 })
    expect(created.player.teamId).toBe(created.newTeam?.id)

    expect(await rejection(game({ allowPlayerTeams: false }), join)).toBe(
      'Players cannot create teams in this game'
    )
    await db.teams.add(team('t1', 'g1'))
    expect(await rejection(game({ maxTeams: 1 }), join)).toBe('No more teams can be created')
  })

  it('caps player-created teams even without a team limit', async () => {
    const teams = Array.from({ length: MAX_LOBBY_TEAMS }, (_, i) => team(`t${i}`, 'g1'))
    await db.teams.bulkAdd(teams)
    expect(await rejection(game(), { ...JOIN, newTeamName: 'One more' })).toBe(
      'No more teams can be created'
    )
  })

  it('joins an existing team with the same name instead of creating one', async () => {
    await db.teams.add({ ...team('t1', 'g1'), name: 'Owls' })
    const joined = await accepted(game({ maxTeams: 1 }), { ...JOIN, newTeamName: 'owls' })
    expect(joined.newTeam).toBeNull()
    expect(joined.player.teamId).toBe('t1')
  })

  it('requires a team when individual play is off', async () => {
    await db.teams.add(team('t1', 'g1'))
    const g = game({ allowIndividual: false })
    expect(await rejection(g, JOIN)).toBe('Pick a team to join')
    expect(await rejection(g, { ...JOIN, teamId: 't1' })).toBeNull()
  })
})
