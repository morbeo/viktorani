// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import { buildLobbyInfo } from '@/pages/admin/gamemaster-utils'
import type { Game, Player, Team } from '@/db'

const GAME = {
  allowIndividual: true,
  allowPlayerTeams: true,
  maxTeams: 0,
  maxPerTeam: 0,
} as Game

function team(id: string): Team {
  return {
    id,
    gameId: 'g1',
    name: `Team ${id}`,
    color: '#000',
    icon: 'Shield',
    score: 0,
    notes: '',
  }
}

function member(id: string, teamId: string): Player {
  return {
    id,
    gameId: 'g1',
    name: id,
    teamId,
    score: 0,
    presence: 'connected',
    deviceId: id,
    joinedAt: 0,
    notes: '',
  }
}

describe('buildLobbyInfo', () => {
  it('lists teams by id and name with the game settings', () => {
    expect(buildLobbyInfo(GAME, [team('t1')], [])).toEqual({
      type: 'LOBBY_INFO',
      teams: [{ id: 't1', name: 'Team t1' }],
      allowIndividual: true,
      allowPlayerTeams: true,
    })
  })

  it('leaves out full teams', () => {
    const teams = [team('t1'), team('t2')]
    const info = buildLobbyInfo({ ...GAME, maxPerTeam: 1 }, teams, [member('p1', 't1')])
    expect(info.teams.map(t => t.id)).toEqual(['t2'])
  })

  it('stops offering new teams at the team limit or when turned off', () => {
    const canCreate = (game: Game, teams: Team[]) =>
      buildLobbyInfo(game, teams, []).allowPlayerTeams
    expect(canCreate({ ...GAME, maxTeams: 1 }, [team('t1')])).toBe(false)
    expect(canCreate({ ...GAME, maxTeams: 2 }, [team('t1')])).toBe(true)
    expect(canCreate({ ...GAME, allowPlayerTeams: false }, [])).toBe(false)
  })
})
