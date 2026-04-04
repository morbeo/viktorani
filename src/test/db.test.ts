import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, seedDefaults } from '@/db'
import type { Question } from '@/db'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await Promise.all([
    db.categories.clear(),
    db.difficulties.clear(),
    db.tags.clear(),
    db.questions.clear(),
    db.rounds.clear(),
    db.games.clear(),
    db.notes.clear(),
    db.teams.clear(),
    db.players.clear(),
    db.gameQuestions.clear(),
    db.buzzEvents.clear(),
    db.layouts.clear(),
    db.widgets.clear(),
    db.timers.clear(),
  ])
}

// ── seedDefaults ──────────────────────────────────────────────────────────────

describe('seedDefaults', () => {
  beforeEach(clearAll)

  it('seeds difficulties and tags on first run', async () => {
    await seedDefaults()
    expect(await db.difficulties.count()).toBeGreaterThanOrEqual(3)
    expect(await db.tags.count()).toBeGreaterThanOrEqual(8)
  })

  it('seeds difficulty names Easy, Medium, Hard', async () => {
    await seedDefaults()
    const names = (await db.difficulties.toArray()).map(d => d.name)
    expect(names).toContain('Easy')
    expect(names).toContain('Medium')
    expect(names).toContain('Hard')
  })

  it('is idempotent — running twice does not duplicate data', async () => {
    await seedDefaults()
    const countAfterFirst = await db.difficulties.count()
    await seedDefaults()
    expect(await db.difficulties.count()).toBe(countAfterFirst)
  })

  it('seeds correct score values in ascending order', async () => {
    await seedDefaults()
    const diffs = await db.difficulties.orderBy('order').toArray()
    expect(diffs[0].score).toBe(5)
    expect(diffs[1].score).toBe(10)
    expect(diffs[2].score).toBe(15)
  })

  it('seeds default tags including Pop Culture, Science, History, Music', async () => {
    await seedDefaults()
    const names = (await db.tags.toArray()).map(t => t.name)
    expect(names).toContain('Pop Culture')
    expect(names).toContain('Science')
    expect(names).toContain('History')
    expect(names).toContain('Music')
  })

  it('skips seeding when difficulties already exist', async () => {
    await db.difficulties.add({ id: 'existing', name: 'Custom', score: 1, color: '#000', order: 0 })
    await seedDefaults()
    // Guard checks difficulties.count() > 0 — should skip, count stays at 1
    expect(await db.difficulties.count()).toBe(1)
  })
})

// ── DB schema ─────────────────────────────────────────────────────────────────

describe('DB schema', () => {
  beforeEach(clearAll)

  it('inserts and retrieves a question', async () => {
    const q: Question = {
      id: 'q1',
      title: 'What is 2+2?',
      type: 'open_ended',
      options: [],
      answer: '4',
      description: '',
      categoryId: null,
      difficulty: null,
      tags: [],
      media: null,
      mediaType: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.questions.add(q)
    const fetched = await db.questions.get('q1')
    expect(fetched?.title).toBe('What is 2+2?')
    expect(fetched?.answer).toBe('4')
  })

  it('preserves question type and options array', async () => {
    await db.questions.add({
      id: 'q2',
      title: 'True or False?',
      type: 'true_false',
      options: ['True', 'False'],
      answer: 'True',
      description: '',
      categoryId: null,
      difficulty: null,
      tags: [],
      media: null,
      mediaType: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const q = await db.questions.get('q2')
    expect(q?.type).toBe('true_false')
    expect(q?.options).toEqual(['True', 'False'])
  })

  it('preserves round questionIds order', async () => {
    await db.rounds.add({
      id: 'r1',
      name: 'Round 1',
      description: '',
      questionIds: ['q3', 'q1', 'q2'],
      createdAt: Date.now(),
    })
    const r = await db.rounds.get('r1')
    expect(r?.questionIds).toEqual(['q3', 'q1', 'q2'])
  })

  it('inserts a game with waiting status', async () => {
    const game = {
      id: 'g1',
      name: 'Test Game',
      status: 'waiting' as const,
      transportMode: 'auto' as const,
      roomId: 'XYZ123',
      passphrase: 'a-b-c-d',
      scoringEnabled: true,
      showQuestion: true,
      showAnswers: false,
      showMedia: true,
      maxTeams: 0,
      maxPerTeam: 0,
      allowIndividual: true,
      roundIds: [],
      currentRoundIdx: 0,
      currentQuestionIdx: 0,
      buzzerLocked: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.games.add(game)
    const fetched = await db.games.get('g1')
    expect(fetched?.status).toBe('waiting')
    expect(fetched?.roomId).toBe('XYZ123')
  })

  it('stores note with markdown content', async () => {
    await db.notes.add({
      id: 'n1',
      name: 'Intro',
      content: '# Welcome\nLets play!',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    expect((await db.notes.get('n1'))?.content).toContain('Welcome')
  })

  it('queries games by status index', async () => {
    const base = {
      transportMode: 'auto' as const,
      roomId: 'X',
      passphrase: null,
      scoringEnabled: true,
      showQuestion: true,
      showAnswers: false,
      showMedia: true,
      maxTeams: 0,
      maxPerTeam: 0,
      allowIndividual: true,
      roundIds: [],
      currentRoundIdx: 0,
      currentQuestionIdx: 0,
      buzzerLocked: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.games.bulkAdd([
      { ...base, id: 'g1', name: 'A', status: 'active' as const },
      { ...base, id: 'g2', name: 'B', status: 'waiting' as const },
      { ...base, id: 'g3', name: 'C', status: 'active' as const },
    ])
    const active = await db.games.where('status').equals('active').toArray()
    expect(active).toHaveLength(2)
  })

  it('bulk deletes questions', async () => {
    const base = {
      type: 'open_ended' as const,
      options: [],
      answer: '',
      description: '',
      categoryId: null,
      difficulty: null,
      tags: [],
      media: null,
      mediaType: null,
      createdAt: 0,
      updatedAt: 0,
    }
    await db.questions.bulkAdd([
      { ...base, id: 'qa', title: 'Q A' },
      { ...base, id: 'qb', title: 'Q B' },
      { ...base, id: 'qc', title: 'Q C' },
    ])
    await db.questions.bulkDelete(['qa', 'qb'])
    expect(await db.questions.count()).toBe(1)
    expect(await db.questions.get('qc')).toBeDefined()
  })

  it('queries teams by gameId', async () => {
    await db.teams.add({ id: 't1', gameId: 'g1', name: 'Red Team', color: '#f00', score: 0 })
    await db.teams.add({ id: 't2', gameId: 'g2', name: 'Blue Team', color: '#00f', score: 0 })
    const teams = await db.teams.where('gameId').equals('g1').toArray()
    expect(teams).toHaveLength(1)
    expect(teams[0].name).toBe('Red Team')
  })

  it('orders buzz events by timestamp', async () => {
    await db.buzzEvents.bulkAdd([
      { id: 'b1', gameId: 'g1', playerId: 'p1', questionId: 'q1', timestamp: 1000, correct: null },
      { id: 'b2', gameId: 'g1', playerId: 'p2', questionId: 'q1', timestamp: 1050, correct: null },
      { id: 'b3', gameId: 'g1', playerId: 'p3', questionId: 'q1', timestamp: 900, correct: null },
    ])
    const events = await db.buzzEvents.orderBy('timestamp').toArray()
    expect(events.map(e => e.timestamp)).toEqual([900, 1000, 1050])
  })
})

// ── snapshot ──────────────────────────────────────────────────────────────────

describe('importDatabase', () => {
  beforeEach(clearAll)

  async function makeFile(snapshot: object) {
    return new File([JSON.stringify(snapshot)], 'backup.json', { type: 'application/json' })
  }

  it('imports categories', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    await importDatabase(
      await makeFile({
        version: 1,
        exportedAt: Date.now(),
        categories: [{ id: 'cat1', name: 'Sport', color: '#ff0' }],
        difficulties: [],
        tags: [],
        questions: [],
        rounds: [],
        games: [],
        notes: [],
      })
    )
    expect(await db.categories.get('cat1')).toBeDefined()
  })

  it('throws on unsupported version', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    await expect(importDatabase(await makeFile({ version: 99 }))).rejects.toThrow(
      'Unsupported snapshot version: 99'
    )
  })

  it('overwrites existing record with same id', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    await db.categories.add({ id: 'cat1', name: 'Original', color: '#000' })
    await importDatabase(
      await makeFile({
        version: 1,
        exportedAt: Date.now(),
        categories: [{ id: 'cat1', name: 'Updated', color: '#fff' }],
        difficulties: [],
        tags: [],
        questions: [],
        rounds: [],
        games: [],
        notes: [],
      })
    )
    expect((await db.categories.get('cat1'))?.name).toBe('Updated')
  })

  it('imports multiple collections atomically', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    const now = Date.now()
    await importDatabase(
      await makeFile({
        version: 1,
        exportedAt: now,
        categories: [{ id: 'c1', name: 'Cat', color: '#f00' }],
        difficulties: [{ id: 'd1', name: 'Easy', score: 5, color: '#0f0', order: 0 }],
        tags: [{ id: 't1', name: 'Music', color: '#00f' }],
        questions: [],
        rounds: [{ id: 'r1', name: 'Round 1', description: '', questionIds: [], createdAt: now }],
        games: [],
        notes: [{ id: 'n1', name: 'Welcome', content: 'Hello', createdAt: now, updatedAt: now }],
      })
    )
    expect(await db.categories.count()).toBe(1)
    expect(await db.difficulties.count()).toBe(1)
    expect(await db.tags.count()).toBe(1)
    expect(await db.rounds.count()).toBe(1)
    expect(await db.notes.count()).toBe(1)
  })
})

describe('exportDatabase', () => {
  beforeEach(clearAll)

  it('triggers a file download', async () => {
    const { exportDatabase } = await import('@/db/snapshot')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await exportDatabase()
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('revokes the object URL after download', async () => {
    const { exportDatabase } = await import('@/db/snapshot')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await exportDatabase()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
