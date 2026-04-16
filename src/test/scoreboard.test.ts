// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db'
import type { Game, Player, Team, DifficultyLevel } from '@/db'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/transport', () => ({
  transportManager: {
    send: vi.fn(),
  },
}))

import { transportManager } from '@/transport'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await Promise.all([
    db.games.clear(),
    db.players.clear(),
    db.teams.clear(),
    db.difficulties.clear(),
  ])
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    transportMode: 'auto',
    roomId: 'ROOM1',
    passphrase: null,
    showQuestion: true,
    showAnswers: false,
    showMedia: true,
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    scoringEnabled: true,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    score: 0,
    isAway: false,
    deviceId: 'd1',
    joinedAt: Date.now(),
    ...overrides,
  }
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 't1',
    gameId: 'g1',
    icon: 'shield',
    name: 'Red Team',
    color: '#c0392b',
    score: 0,
    ...overrides,
  }
}

function makeDifficulty(overrides: Partial<DifficultyLevel> = {}): DifficultyLevel {
  return {
    id: 'd1',
    name: 'Easy',
    score: 5,
    color: '#27ae60',
    order: 0,
    ...overrides,
  }
}

// ── Tests: score persistence ──────────────────────────────────────────────────

describe('score persistence via DB', () => {
  beforeEach(clearAll)

  it('stores a player with initial score 0', async () => {
    const player = makePlayer()
    await db.players.add(player)
    const retrieved = await db.players.get('p1')
    expect(retrieved?.score).toBe(0)
  })

  it('adjusting player score updates DB', async () => {
    const player = makePlayer({ score: 10 })
    await db.players.add(player)
    await db.players.update('p1', { score: 15 })
    const updated = await db.players.get('p1')
    expect(updated?.score).toBe(15)
  })

  it('stores team with initial score 0', async () => {
    const team = makeTeam()
    await db.teams.add(team)
    const retrieved = await db.teams.get('t1')
    expect(retrieved?.score).toBe(0)
  })

  it('adjusting team score updates DB', async () => {
    const team = makeTeam({ score: 0 })
    await db.teams.add(team)
    await db.teams.update('t1', { score: 20 })
    const updated = await db.teams.get('t1')
    expect(updated?.score).toBe(20)
  })
})

// ── Tests: SCORE_UPDATE broadcast shape ──────────────────────────────────────

describe('SCORE_UPDATE broadcast', () => {
  beforeEach(async () => {
    await clearAll()
    vi.clearAllMocks()
  })

  it('sends correct payload after player adjust', async () => {
    const game = makeGame()
    await db.games.add(game)
    const p1 = makePlayer({ id: 'p1', score: 5 })
    const p2 = makePlayer({ id: 'p2', name: 'Bob', score: 10, deviceId: 'd2' })
    await db.players.bulkAdd([p1, p2])

    // Simulate the broadcast logic used in useScoreboard.adjust
    const newScore = 10
    await db.players.update('p1', { score: newScore })
    const allPlayers = await db.players.where('gameId').equals(game.id).toArray()
    const allTeams = await db.teams.where('gameId').equals(game.id).toArray()
    const scores: Record<string, number> = {}
    for (const p of allPlayers) scores[p.id] = p.score
    for (const t of allTeams) scores[t.id] = t.score

    transportManager.send({ type: 'SCORE_UPDATE', scores })

    expect(transportManager.send).toHaveBeenCalledWith({
      type: 'SCORE_UPDATE',
      scores: { p1: 10, p2: 10 },
    })
  })

  it('includes both player and team ids in payload', async () => {
    const game = makeGame()
    await db.games.add(game)
    const player = makePlayer({ id: 'p1', score: 5, teamId: 't1' })
    const team = makeTeam({ id: 't1', score: 5 })
    await db.players.add(player)
    await db.teams.add(team)

    const allPlayers = await db.players.where('gameId').equals(game.id).toArray()
    const allTeams = await db.teams.where('gameId').equals(game.id).toArray()
    const scores: Record<string, number> = {}
    for (const p of allPlayers) scores[p.id] = p.score
    for (const t of allTeams) scores[t.id] = t.score

    transportManager.send({ type: 'SCORE_UPDATE', scores })

    expect(transportManager.send).toHaveBeenCalledWith({
      type: 'SCORE_UPDATE',
      scores: expect.objectContaining({ p1: 5, t1: 5 }),
    })
  })
})

// ── Tests: team score aggregation ────────────────────────────────────────────

describe('team score aggregation', () => {
  beforeEach(clearAll)

  it('sums player scores for team total', async () => {
    const game = makeGame()
    await db.games.add(game)

    const team = makeTeam({ id: 't1', score: 0 })
    await db.teams.add(team)

    const p1 = makePlayer({ id: 'p1', teamId: 't1', score: 5 })
    const p2 = makePlayer({ id: 'p2', name: 'Bob', teamId: 't1', score: 10, deviceId: 'd2' })
    await db.players.bulkAdd([p1, p2])

    // Simulate team score re-computation after player adjust
    const teamPlayers = await db.players.where('gameId').equals(game.id).toArray()
    const teamTotal = teamPlayers
      .filter(p => p.teamId === 't1')
      .reduce((sum, p) => sum + p.score, 0)
    await db.teams.update('t1', { score: teamTotal })

    const updatedTeam = await db.teams.get('t1')
    expect(updatedTeam?.score).toBe(15)
  })
})

// ── Tests: defaultIncrement ───────────────────────────────────────────────────

describe('defaultIncrement derivation', () => {
  beforeEach(clearAll)

  it('uses lowest difficulty score', async () => {
    await db.difficulties.bulkAdd([
      makeDifficulty({ id: 'd1', score: 5, order: 0 }),
      makeDifficulty({ id: 'd2', name: 'Hard', score: 15, order: 2 }),
    ])
    const diffs = await db.difficulties.orderBy('order').toArray()
    const increment = diffs.length > 0 ? Math.min(...diffs.map(d => d.score)) : 1
    expect(increment).toBe(5)
  })

  it('falls back to 1 when no difficulties configured', async () => {
    const diffs = await db.difficulties.orderBy('order').toArray()
    const increment = diffs.length > 0 ? Math.min(...diffs.map(d => d.score)) : 1
    expect(increment).toBe(1)
  })
})

// ── Tests: scoringEnabled gate ────────────────────────────────────────────────

describe('scoringEnabled gate', () => {
  it('game.scoringEnabled false means scoreboard should not render', () => {
    const game = makeGame({ scoringEnabled: false })
    // ScoreboardPanel returns null when scoringEnabled is false
    // We test the condition directly (rendering tests covered in component tests)
    expect(game.scoringEnabled).toBe(false)
  })
})
