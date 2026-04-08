// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import type { Game, Player } from '@/db'
import {
  serialiseGameState,
  canStartGame,
  upsertPlayer,
  markPlayerAway,
} from '@/pages/admin/gamemaster-utils'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_GAME: Game = {
  id: 'g1',
  name: 'Test Night',
  status: 'waiting',
  transportMode: 'peer',
  roomId: 'ABC123',
  passphrase: null,
  scoringEnabled: true,
  showQuestion: true,
  showAnswers: false,
  showMedia: true,
  maxTeams: 0,
  maxPerTeam: 0,
  allowIndividual: true,
  roundIds: ['r1', 'r2'],
  currentRoundIdx: 0,
  currentQuestionIdx: 0,
  buzzerLocked: true,
  createdAt: 1000,
  updatedAt: 1000,
}

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

// ── serialiseGameState ────────────────────────────────────────────────────────

describe('serialiseGameState', () => {
  it('maps all game fields correctly', () => {
    const state = serialiseGameState(BASE_GAME, [])
    expect(state.gameId).toBe('g1')
    expect(state.status).toBe('waiting')
    expect(state.currentRoundIdx).toBe(0)
    expect(state.currentQuestionIdx).toBe(0)
    expect(state.buzzerLocked).toBe(true)
    expect(state.showQuestion).toBe(true)
    expect(state.showAnswers).toBe(false)
    expect(state.showMedia).toBe(true)
  })

  it('builds scores map from players', () => {
    const players = [makePlayer({ id: 'p1', score: 10 }), makePlayer({ id: 'p2', score: 25 })]
    const state = serialiseGameState(BASE_GAME, players)
    expect(state.scores).toEqual({ p1: 10, p2: 25 })
  })

  it('returns empty scores when no players', () => {
    const state = serialiseGameState(BASE_GAME, [])
    expect(state.scores).toEqual({})
  })

  it('includes away players in scores', () => {
    const players = [makePlayer({ id: 'p1', score: 5, isAway: true })]
    const state = serialiseGameState(BASE_GAME, players)
    expect(state.scores['p1']).toBe(5)
  })

  it('reflects updated game status after start', () => {
    const active = { ...BASE_GAME, status: 'active' as const }
    expect(serialiseGameState(active, []).status).toBe('active')
  })
})

// ── canStartGame ──────────────────────────────────────────────────────────────

describe('canStartGame', () => {
  it('returns true when connected and players present', () => {
    expect(
      canStartGame({ transportStatus: 'connected', activePlayers: 3, soloBypass: false })
    ).toBe(true)
  })

  it('returns false when connected but no players', () => {
    expect(
      canStartGame({ transportStatus: 'connected', activePlayers: 0, soloBypass: false })
    ).toBe(false)
  })

  it('returns false when players present but not connected', () => {
    expect(
      canStartGame({ transportStatus: 'connecting', activePlayers: 3, soloBypass: false })
    ).toBe(false)
  })

  it('returns false when idle', () => {
    expect(canStartGame({ transportStatus: 'idle', activePlayers: 2, soloBypass: false })).toBe(
      false
    )
  })

  it('returns false on error status', () => {
    expect(canStartGame({ transportStatus: 'error', activePlayers: 5, soloBypass: false })).toBe(
      false
    )
  })

  it('soloBypass overrides transport and player requirements', () => {
    expect(canStartGame({ transportStatus: 'idle', activePlayers: 0, soloBypass: true })).toBe(true)
    expect(canStartGame({ transportStatus: 'error', activePlayers: 0, soloBypass: true })).toBe(
      true
    )
  })

  it('returns true for exactly 1 player', () => {
    expect(
      canStartGame({ transportStatus: 'connected', activePlayers: 1, soloBypass: false })
    ).toBe(true)
  })
})

// ── upsertPlayer ──────────────────────────────────────────────────────────────

describe('upsertPlayer', () => {
  const incoming = {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    deviceId: 'dev-1',
  }

  it('adds a new player to an empty list', () => {
    const result = upsertPlayer([], incoming)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
    expect(result[0].name).toBe('Alice')
  })

  it('sets score to 0 and isAway to false for new player', () => {
    const result = upsertPlayer([], incoming)
    expect(result[0].score).toBe(0)
    expect(result[0].isAway).toBe(false)
  })

  it('updates name and marks as not-away for returning player', () => {
    const existing = makePlayer({ id: 'p1', name: 'Old Name', isAway: true, score: 15 })
    const result = upsertPlayer([existing], { ...incoming, name: 'Alice Updated' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice Updated')
    expect(result[0].isAway).toBe(false)
  })

  it('preserves existing score on rejoin', () => {
    const existing = makePlayer({ id: 'p1', score: 20 })
    const result = upsertPlayer([existing], incoming)
    expect(result[0].score).toBe(20)
  })

  it('preserves existing joinedAt on rejoin', () => {
    const existing = makePlayer({ id: 'p1', joinedAt: 500 })
    const result = upsertPlayer([existing], incoming)
    expect(result[0].joinedAt).toBe(500)
  })

  it('does not duplicate the player', () => {
    const existing = makePlayer({ id: 'p1' })
    const result = upsertPlayer([existing], incoming)
    expect(result).toHaveLength(1)
  })

  it('preserves other players when upserting', () => {
    const p2 = makePlayer({ id: 'p2', name: 'Bob', joinedAt: 2000 })
    const result = upsertPlayer([p2], incoming)
    expect(result).toHaveLength(2)
    expect(result.map(p => p.id)).toContain('p2')
  })

  it('sorts by joinedAt ascending', () => {
    const p2 = makePlayer({ id: 'p2', name: 'Bob', joinedAt: 2000 })
    const p3 = makePlayer({ id: 'p3', name: 'Carol', joinedAt: 3000 })
    // incoming gets joinedAt = Date.now() which is > 3000 in tests
    const result = upsertPlayer([p2, p3], { ...incoming, id: 'p1' })
    expect(result[0].id).toBe('p2')
    expect(result[1].id).toBe('p3')
  })
})

// ── markPlayerAway ────────────────────────────────────────────────────────────

describe('markPlayerAway', () => {
  it('marks the specified player as away', () => {
    const players = [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })]
    const result = markPlayerAway(players, 'p1')
    expect(result.find(p => p.id === 'p1')?.isAway).toBe(true)
  })

  it('leaves other players unchanged', () => {
    const players = [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })]
    const result = markPlayerAway(players, 'p1')
    expect(result.find(p => p.id === 'p2')?.isAway).toBe(false)
  })

  it('is a no-op for an unknown playerId', () => {
    const players = [makePlayer({ id: 'p1' })]
    const result = markPlayerAway(players, 'unknown')
    expect(result[0].isAway).toBe(false)
  })

  it('does not mutate the original array', () => {
    const players = [makePlayer({ id: 'p1' })]
    markPlayerAway(players, 'p1')
    expect(players[0].isAway).toBe(false)
  })

  it('handles already-away player gracefully', () => {
    const players = [makePlayer({ id: 'p1', isAway: true })]
    const result = markPlayerAway(players, 'p1')
    expect(result[0].isAway).toBe(true)
  })

  it('handles empty list', () => {
    expect(markPlayerAway([], 'p1')).toHaveLength(0)
  })
})
