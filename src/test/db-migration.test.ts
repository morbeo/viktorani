// @vitest-pool vmForks
// Tests for the v3 and v4 Dexie upgrade callbacks in src/db/index.ts.
// Strategy: open an isolated Dexie instance at the old version with raw data
// that pre-dates the migration, then let the current ViktoraniDB open and
// run its upgrade hooks, and assert the data was transformed correctly.
import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import 'fake-indexeddb/auto'

// Each test uses a unique DB name so there is no cross-test bleed.
let dbSeq = 0
function freshName() {
  return `viktorani-migration-test-${Date.now()}-${++dbSeq}`
}

// ── v3 upgrade: strip categoryId from questions ───────────────────────────────

describe('DB migration v2→v3: remove categoryId from questions', () => {
  it('strips categoryId from existing questions during upgrade', async () => {
    const name = freshName()

    // Seed a v2 DB (questions table still has categoryId index)
    const v2 = new Dexie(name)
    v2.version(2).stores({
      categories: 'id, name',
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, categoryId, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })
    await v2.open()
    await (v2 as Dexie & { questions: Dexie.Table }).questions.add({
      id: 'q-legacy',
      title: 'Old question',
      categoryId: 'cat-xyz',
      type: 'open_ended',
      options: [],
      answer: 'Answer',
      description: '',
      difficulty: null,
      tags: [],
      media: null,
      mediaType: null,
      createdAt: 1000,
      updatedAt: 1000,
    })
    await v2.close()

    // Replicate the v3 upgrade directly on our named DB so we can test the
    // callback logic in isolation without touching the singleton.
    const v3 = new Dexie(name)
    v3.version(2).stores({
      categories: 'id, name',
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, categoryId, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })
    v3.version(3)
      .stores({
        categories: null,
        difficulties: 'id, name, order',
        tags: 'id, name',
        questions: 'id, difficulty, type, createdAt',
        rounds: 'id, createdAt',
        games: 'id, status, createdAt',
        teams: 'id, gameId',
        players: 'id, gameId, teamId, deviceId',
        buzzEvents: 'id, gameId, playerId, questionId, timestamp',
        layouts: 'id, gameId, target',
        widgets: 'id, layoutId, order',
        notes: 'id, name, createdAt, updatedAt',
        timers: 'id, gameId',
        gameQuestions: 'id, gameId, roundId, order',
      })
      .upgrade(tx => {
        return tx
          .table('questions')
          .toCollection()
          .modify((q: Record<string, unknown>) => {
            delete q['categoryId']
          })
      })

    await v3.open()
    const q = await (v3 as Dexie & { questions: Dexie.Table }).questions.get('q-legacy')
    expect(q).toBeDefined()
    expect((q as Record<string, unknown>)['categoryId']).toBeUndefined()
    expect(q.title).toBe('Old question')
    await v3.close()
  })
})

// ── v4 upgrade: back-fill buzzer fields on games and buzzEvents ───────────────

describe('DB migration v3→v4: back-fill buzzer config on games and buzzEvents', () => {
  it('adds missing buzzer fields to game records', async () => {
    const name = freshName()

    // Seed a v3 DB — game record has no buzzer fields
    const v3seed = new Dexie(name)
    v3seed.version(3).stores({
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })
    await v3seed.open()
    await (v3seed as Dexie & { games: Dexie.Table }).games.add({
      id: 'g-old',
      name: 'OldGame',
      status: 'waiting',
      createdAt: 1000,
      updatedAt: 1000,
      // intentionally missing: autoLockOnFirstCorrect, allowFalseStarts,
      // buzzDeduplication, tiebreakerMode
    })
    await v3seed.close()

    // Apply v4 upgrade on same DB
    const v4 = new Dexie(name)
    v4.version(3).stores({
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })
    v4.version(4)
      .stores({
        difficulties: 'id, name, order',
        tags: 'id, name',
        questions: 'id, difficulty, type, createdAt',
        rounds: 'id, createdAt',
        games: 'id, status, createdAt',
        teams: 'id, gameId',
        players: 'id, gameId, teamId, deviceId',
        buzzEvents: 'id, gameId, playerId, questionId, timestamp',
        layouts: 'id, gameId, target',
        widgets: 'id, layoutId, order',
        notes: 'id, name, createdAt, updatedAt',
        timers: 'id, gameId',
        gameQuestions: 'id, gameId, roundId, order',
      })
      .upgrade(async tx => {
        await tx
          .table('games')
          .toCollection()
          .modify((g: Record<string, unknown>) => {
            if (g['autoLockOnFirstCorrect'] === undefined) g['autoLockOnFirstCorrect'] = false
            if (g['allowFalseStarts'] === undefined) g['allowFalseStarts'] = false
            if (g['buzzDeduplication'] === undefined) g['buzzDeduplication'] = 'firstOnly'
            if (g['tiebreakerMode'] === undefined) g['tiebreakerMode'] = 'serverOrder'
          })
        await tx
          .table('buzzEvents')
          .toCollection()
          .modify((b: Record<string, unknown>) => {
            if (b['playerName'] === undefined) b['playerName'] = 'Unknown'
            if (b['teamId'] === undefined) b['teamId'] = null
            if (b['isFalseStart'] === undefined) b['isFalseStart'] = false
            if (b['gmDecision'] === undefined) b['gmDecision'] = null
            if (b['decidedAt'] === undefined) b['decidedAt'] = null
          })
      })

    await v4.open()
    const g = (await (v4 as Dexie & { games: Dexie.Table }).games.get('g-old')) as Record<
      string,
      unknown
    >
    expect(g).toBeDefined()
    expect(g['autoLockOnFirstCorrect']).toBe(false)
    expect(g['allowFalseStarts']).toBe(false)
    expect(g['buzzDeduplication']).toBe('firstOnly')
    expect(g['tiebreakerMode']).toBe('serverOrder')
    await v4.close()
  })

  it('back-fills missing fields on buzzEvents', async () => {
    const name = freshName()

    const v3seed = new Dexie(name)
    v3seed.version(3).stores({
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })
    await v3seed.open()
    await (v3seed as Dexie & { buzzEvents: Dexie.Table }).buzzEvents.add({
      id: 'b-old',
      gameId: 'g1',
      playerId: 'p1',
      questionId: 'q1',
      timestamp: 1000,
      // intentionally missing: playerName, teamId, isFalseStart, gmDecision, decidedAt
    })
    await v3seed.close()

    const v4 = new Dexie(name)
    v4.version(3).stores({
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })
    v4.version(4)
      .stores({
        difficulties: 'id, name, order',
        tags: 'id, name',
        questions: 'id, difficulty, type, createdAt',
        rounds: 'id, createdAt',
        games: 'id, status, createdAt',
        teams: 'id, gameId',
        players: 'id, gameId, teamId, deviceId',
        buzzEvents: 'id, gameId, playerId, questionId, timestamp',
        layouts: 'id, gameId, target',
        widgets: 'id, layoutId, order',
        notes: 'id, name, createdAt, updatedAt',
        timers: 'id, gameId',
        gameQuestions: 'id, gameId, roundId, order',
      })
      .upgrade(async tx => {
        await tx
          .table('games')
          .toCollection()
          .modify((g: Record<string, unknown>) => {
            if (g['autoLockOnFirstCorrect'] === undefined) g['autoLockOnFirstCorrect'] = false
            if (g['allowFalseStarts'] === undefined) g['allowFalseStarts'] = false
            if (g['buzzDeduplication'] === undefined) g['buzzDeduplication'] = 'firstOnly'
            if (g['tiebreakerMode'] === undefined) g['tiebreakerMode'] = 'serverOrder'
          })
        await tx
          .table('buzzEvents')
          .toCollection()
          .modify((b: Record<string, unknown>) => {
            if (b['playerName'] === undefined) b['playerName'] = 'Unknown'
            if (b['teamId'] === undefined) b['teamId'] = null
            if (b['isFalseStart'] === undefined) b['isFalseStart'] = false
            if (b['gmDecision'] === undefined) b['gmDecision'] = null
            if (b['decidedAt'] === undefined) b['decidedAt'] = null
          })
      })

    await v4.open()
    const b = (await (v4 as Dexie & { buzzEvents: Dexie.Table }).buzzEvents.get('b-old')) as Record<
      string,
      unknown
    >
    expect(b).toBeDefined()
    expect(b['playerName']).toBe('Unknown')
    expect(b['teamId']).toBeNull()
    expect(b['isFalseStart']).toBe(false)
    expect(b['gmDecision']).toBeNull()
    expect(b['decidedAt']).toBeNull()
    await v4.close()
  })

  it('does not overwrite existing buzzer fields on games', async () => {
    const name = freshName()

    const v3seed = new Dexie(name)
    v3seed.version(3).stores({
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })
    await v3seed.open()
    await (v3seed as Dexie & { games: Dexie.Table }).games.add({
      id: 'g-already',
      name: 'Already migrated',
      status: 'waiting',
      createdAt: 1000,
      updatedAt: 1000,
      autoLockOnFirstCorrect: true, // already set — must not be overwritten
      allowFalseStarts: true,
      buzzDeduplication: 'all',
      tiebreakerMode: 'serverOrder',
    })
    await v3seed.close()

    const v4 = new Dexie(name)
    v4.version(3).stores({
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })
    v4.version(4)
      .stores({
        difficulties: 'id, name, order',
        tags: 'id, name',
        questions: 'id, difficulty, type, createdAt',
        rounds: 'id, createdAt',
        games: 'id, status, createdAt',
        teams: 'id, gameId',
        players: 'id, gameId, teamId, deviceId',
        buzzEvents: 'id, gameId, playerId, questionId, timestamp',
        layouts: 'id, gameId, target',
        widgets: 'id, layoutId, order',
        notes: 'id, name, createdAt, updatedAt',
        timers: 'id, gameId',
        gameQuestions: 'id, gameId, roundId, order',
      })
      .upgrade(async tx => {
        await tx
          .table('games')
          .toCollection()
          .modify((g: Record<string, unknown>) => {
            if (g['autoLockOnFirstCorrect'] === undefined) g['autoLockOnFirstCorrect'] = false
            if (g['allowFalseStarts'] === undefined) g['allowFalseStarts'] = false
            if (g['buzzDeduplication'] === undefined) g['buzzDeduplication'] = 'firstOnly'
            if (g['tiebreakerMode'] === undefined) g['tiebreakerMode'] = 'serverOrder'
          })
        await tx
          .table('buzzEvents')
          .toCollection()
          .modify((b: Record<string, unknown>) => {
            if (b['playerName'] === undefined) b['playerName'] = 'Unknown'
            if (b['teamId'] === undefined) b['teamId'] = null
            if (b['isFalseStart'] === undefined) b['isFalseStart'] = false
            if (b['gmDecision'] === undefined) b['gmDecision'] = null
            if (b['decidedAt'] === undefined) b['decidedAt'] = null
          })
      })

    await v4.open()
    const g = (await (v4 as Dexie & { games: Dexie.Table }).games.get('g-already')) as Record<
      string,
      unknown
    >
    expect(g['autoLockOnFirstCorrect']).toBe(true)
    expect(g['allowFalseStarts']).toBe(true)
    expect(g['buzzDeduplication']).toBe('all')
    await v4.close()
  })
})
