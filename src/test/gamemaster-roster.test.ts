// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import type { Player, Team } from '@/db'
import {
  setPlayerAway,
  assignPlayerTeam,
  canCreateTeam,
  canAssignToTeam,
} from '@/pages/admin/gamemaster-utils'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    score: 0,
    isAway: false,
    deviceId: 'dev-1',
    joinedAt: 1000,
    ...overrides,
  }
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 't1',
    gameId: 'g1',
    name: 'Red Team',
    color: '#e74c3c',
    score: 0,
    ...overrides,
  }
}

// ── setPlayerAway ─────────────────────────────────────────────────────────────

describe('setPlayerAway', () => {
  it('marks the player as away when away=true', () => {
    const players = [makePlayer({ id: 'p1', isAway: false })]
    const result = setPlayerAway(players, 'p1', true)
    expect(result[0].isAway).toBe(true)
  })

  it('marks the player as online when away=false', () => {
    const players = [makePlayer({ id: 'p1', isAway: true })]
    const result = setPlayerAway(players, 'p1', false)
    expect(result[0].isAway).toBe(false)
  })

  it('leaves other players unchanged', () => {
    const players = [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })]
    const result = setPlayerAway(players, 'p1', true)
    expect(result.find(p => p.id === 'p2')?.isAway).toBe(false)
  })

  it('is a no-op for an unknown playerId', () => {
    const players = [makePlayer({ id: 'p1' })]
    const result = setPlayerAway(players, 'unknown', true)
    expect(result[0].isAway).toBe(false)
  })

  it('does not mutate the original array', () => {
    const players = [makePlayer({ id: 'p1' })]
    setPlayerAway(players, 'p1', true)
    expect(players[0].isAway).toBe(false)
  })

  it('handles empty list', () => {
    expect(setPlayerAway([], 'p1', true)).toHaveLength(0)
  })
})

// ── assignPlayerTeam ──────────────────────────────────────────────────────────

describe('assignPlayerTeam', () => {
  it('assigns the player to a team', () => {
    const players = [makePlayer({ id: 'p1', teamId: null })]
    const result = assignPlayerTeam(players, 'p1', 't1')
    expect(result[0].teamId).toBe('t1')
  })

  it('clears team assignment when teamId is null', () => {
    const players = [makePlayer({ id: 'p1', teamId: 't1' })]
    const result = assignPlayerTeam(players, 'p1', null)
    expect(result[0].teamId).toBeNull()
  })

  it('changes team when player is already on a different team', () => {
    const players = [makePlayer({ id: 'p1', teamId: 't1' })]
    const result = assignPlayerTeam(players, 'p1', 't2')
    expect(result[0].teamId).toBe('t2')
  })

  it('leaves other players unchanged', () => {
    const players = [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2', teamId: 't1' })]
    const result = assignPlayerTeam(players, 'p1', 't2')
    expect(result.find(p => p.id === 'p2')?.teamId).toBe('t1')
  })

  it('is a no-op for unknown playerId', () => {
    const players = [makePlayer({ id: 'p1', teamId: null })]
    const result = assignPlayerTeam(players, 'unknown', 't1')
    expect(result[0].teamId).toBeNull()
  })

  it('does not mutate the original array', () => {
    const players = [makePlayer({ id: 'p1', teamId: null })]
    assignPlayerTeam(players, 'p1', 't1')
    expect(players[0].teamId).toBeNull()
  })
})

// ── canCreateTeam ─────────────────────────────────────────────────────────────

describe('canCreateTeam', () => {
  it('always returns true when maxTeams is 0 (unlimited)', () => {
    expect(canCreateTeam({ maxTeams: 0 }, 0)).toBe(true)
    expect(canCreateTeam({ maxTeams: 0 }, 100)).toBe(true)
  })

  it('returns true when below the cap', () => {
    expect(canCreateTeam({ maxTeams: 4 }, 3)).toBe(true)
    expect(canCreateTeam({ maxTeams: 4 }, 0)).toBe(true)
  })

  it('returns false when at the cap', () => {
    expect(canCreateTeam({ maxTeams: 4 }, 4)).toBe(false)
  })

  it('returns false when above the cap', () => {
    expect(canCreateTeam({ maxTeams: 2 }, 5)).toBe(false)
  })

  it('returns true for cap of 1 with 0 teams', () => {
    expect(canCreateTeam({ maxTeams: 1 }, 0)).toBe(true)
  })

  it('returns false for cap of 1 with 1 team', () => {
    expect(canCreateTeam({ maxTeams: 1 }, 1)).toBe(false)
  })
})

// ── canAssignToTeam ───────────────────────────────────────────────────────────

describe('canAssignToTeam', () => {
  it('always returns true when maxPerTeam is 0 (unlimited)', () => {
    const team = makeTeam({ id: 't1' })
    const players = [makePlayer({ id: 'p1', teamId: 't1' }), makePlayer({ id: 'p2', teamId: 't1' })]
    expect(canAssignToTeam({ maxPerTeam: 0 }, team, players, 'p3')).toBe(true)
  })

  it('returns true when team has fewer members than cap', () => {
    const team = makeTeam({ id: 't1' })
    const players = [makePlayer({ id: 'p1', teamId: 't1' })]
    expect(canAssignToTeam({ maxPerTeam: 3 }, team, players, 'p2')).toBe(true)
  })

  it('returns false when team is at cap', () => {
    const team = makeTeam({ id: 't1' })
    const players = [makePlayer({ id: 'p1', teamId: 't1' }), makePlayer({ id: 'p2', teamId: 't1' })]
    expect(canAssignToTeam({ maxPerTeam: 2 }, team, players, 'p3')).toBe(false)
  })

  it('does not double-count player already on the team', () => {
    // p1 is already on t1 — moving p1 from t1 to t1 should not count twice
    const team = makeTeam({ id: 't1' })
    const players = [makePlayer({ id: 'p1', teamId: 't1' }), makePlayer({ id: 'p2', teamId: 't1' })]
    // cap=2, p1 already on t1 — reassigning p1 should be allowed
    expect(canAssignToTeam({ maxPerTeam: 2 }, team, players, 'p1')).toBe(true)
  })

  it('returns true for an empty team with any cap > 0', () => {
    const team = makeTeam({ id: 't1' })
    expect(canAssignToTeam({ maxPerTeam: 1 }, team, [], 'p1')).toBe(true)
  })

  it('counts only members of the target team, not all players', () => {
    const team = makeTeam({ id: 't1' })
    const players = [
      makePlayer({ id: 'p1', teamId: 't2' }), // on a different team
      makePlayer({ id: 'p2', teamId: 't2' }),
    ]
    expect(canAssignToTeam({ maxPerTeam: 1 }, team, players, 'p3')).toBe(true)
  })
})
