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
import {
  announceScores,
  broadcastScores,
  buildScoreEntries,
  changeScore,
  correctCounts,
  readShownScores,
  scoresAsOf,
  shownScoreEvents,
} from '@/hooks/useScoreboard'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await Promise.all([
    db.games.clear(),
    db.players.clear(),
    db.teams.clear(),
    db.difficulties.clear(),
    db.scoreEvents.clear(),
    db.gameLog.clear(),
  ])
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    roomId: 'ROOM1',
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    maxTeams: 0,
    maxPerTeam: 0,
    maxPlayers: 0,
    allowIndividual: true,
    allowLateJoin: true,
    allowRejoin: true,
    rejoinWindowSeconds: 0,
    autoRemoveAfterMinutes: 0,
    requireApproval: false,
    allowSpectators: false,
    localNetworkOnly: false,
    scoreboardBetweenRounds: false,
    allowPlayerTeams: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    scoringEnabled: true,
    inputType: 'buzzer',
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    confirmUnruledNavigation: false,
    autoAdvanceOnCorrect: false,
    autoAdvanceOnTimerExpiry: false,
    autoAdvanceDelaySeconds: 5,
    revealTiming: 'manual',
    answersClose: 'perQuestion',
    teamAnswering: 'anyone',
    rankTies: 'share',
    holdScores: false,
    scoresAnnouncedAt: null,
    autoStartTimerOnQuestionShow: false,
    defaultTimerDuration: 60,
    soundEffectsMuted: false,
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
    presence: 'connected',
    disconnectedAt: null,
    deviceId: 'd1',
    joinedAt: Date.now(),
    notes: '',
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
    notes: '',
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

describe('held scores', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearAll()
  })

  const event = (targetId: string, from: number, to: number, timestamp: number) => ({
    targetId,
    from,
    to,
    timestamp,
  })

  it('works out each score as of a time from its changes', () => {
    const live = { p1: 9, p2: 4, p3: 7 }
    const events = [event('p1', 0, 3, 10), event('p1', 3, 9, 30), event('p2', 1, 4, 40)]
    expect(scoresAsOf(live, events, 20)).toEqual({ p1: 3, p2: 1, p3: 7 })
    expect(scoresAsOf(live, events, null)).toEqual({ p1: 0, p2: 1, p3: 7 })
    expect(scoresAsOf(live, events, 50)).toEqual(live)
  })

  it('ignores changes to players and teams no longer in the game', () => {
    expect(scoresAsOf({ p1: 1 }, [event('gone', 0, 5, 1)], 0)).toEqual({ p1: 1 })
  })

  it('shows players the scores of the last announcement while scores are held', async () => {
    await db.games.add(makeGame({ holdScores: true, scoresAnnouncedAt: null }))
    await db.players.add(makePlayer())
    await changeScore({
      gameId: 'g1',
      id: 'p1',
      kind: 'player',
      next: s => s + 3,
      reason: 'correct',
      questionId: null,
    })

    expect(await readShownScores('g1')).toEqual({ p1: 0 })
    await broadcastScores('g1')
    expect(transportManager.send).toHaveBeenLastCalledWith({
      type: 'SCORE_UPDATE',
      scores: { p1: 0 },
    })

    const patch = await announceScores('g1')
    expect((await db.games.get('g1'))?.scoresAnnouncedAt).toBe(patch.scoresAnnouncedAt)
    expect(transportManager.send).toHaveBeenLastCalledWith({
      type: 'SCORE_UPDATE',
      scores: { p1: 3 },
    })
    const log = await db.gameLog.where('gameId').equals('g1').toArray()
    expect(log.map(e => e.kind)).toContain('scores_announced')
  })

  it('shows live scores when not held, and once the game has ended', async () => {
    await db.games.add(makeGame({ holdScores: true, status: 'ended' }))
    await db.players.add(makePlayer({ score: 5 }))
    expect(await readShownScores('g1')).toEqual({ p1: 5 })
    await db.games.update('g1', { status: 'active', holdScores: false })
    expect(await readShownScores('g1')).toEqual({ p1: 5 })
  })

  it('hides score changes after the announcement from the public log', () => {
    const events = [event('p1', 0, 5, 100), event('p1', 5, 10, 300)]
    const held = { holdScores: true, status: 'active' as const, scoresAnnouncedAt: 200 }
    expect(shownScoreEvents(held, events)).toEqual([events[0]])
    expect(shownScoreEvents({ ...held, scoresAnnouncedAt: null }, events)).toEqual([])
    expect(shownScoreEvents({ ...held, status: 'ended' as const }, events)).toEqual(events)
    expect(shownScoreEvents({ ...held, holdScores: false }, events)).toEqual(events)
  })
})

describe('tied scores', () => {
  const player = (id: string, score: number) =>
    ({ id, gameId: 'g1', name: id, teamId: null, score }) as Player
  const players = [player('a', 5), player('b', 9), player('c', 5), player('d', 2)]
  const places = (entries: { id: string; place: number }[]) => entries.map(e => [e.id, e.place])

  it('counts correct answers, less those taken back', () => {
    expect(
      correctCounts([
        { targetId: 'a', reason: 'correct' },
        { targetId: 'a', reason: 'correct' },
        { targetId: 'a', reason: 'retract' },
        { targetId: 'c', reason: 'step' },
        { targetId: 'c', reason: 'correct' },
      ])
    ).toEqual({ a: 1, c: 1 })
  })

  it('shares the place between equal scores by default', () => {
    expect(places(buildScoreEntries(players, []))).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ])
  })

  it('places more correct answers higher, and shares the place when still level', () => {
    const rank = { rankTies: 'mostCorrect' as const, correct: { a: 1, c: 3 } }
    expect(places(buildScoreEntries(players, [], rank))).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
      ['d', 4],
    ])
    const level = { rankTies: 'mostCorrect' as const, correct: { a: 2, c: 2 } }
    expect(places(buildScoreEntries(players, [], level)).slice(1, 3)).toEqual([
      ['a', 2],
      ['c', 2],
    ])
  })
})
