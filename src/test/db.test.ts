import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, seedDefaults, purgeDatabase } from '@/db'
import type { Question } from '@/db'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await Promise.all([
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

const BASE_QUESTION: Omit<Question, 'id' | 'title'> = {
  type: 'open_ended',
  options: [],
  answer: '',
  description: '',
  difficulty: null,
  tags: [],
  media: null,
  mediaType: null,
  createdAt: 0,
  updatedAt: 0,
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
    const diffCount = await db.difficulties.count()
    const tagCount = await db.tags.count()
    await seedDefaults()
    expect(await db.difficulties.count()).toBe(diffCount)
    expect(await db.tags.count()).toBe(tagCount)
  })

  it('concurrent calls do not duplicate data', async () => {
    await Promise.all([seedDefaults(), seedDefaults()])
    expect(await db.difficulties.count()).toBeGreaterThan(0)
    // Should not have duplicated — count stays at seeded amount
    const names = (await db.difficulties.toArray()).map(d => d.name)
    const easyCount = names.filter(n => n === 'Easy').length
    expect(easyCount).toBe(1)
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

  it('skips seeding difficulties when they already exist', async () => {
    await db.difficulties.add({ id: 'existing', name: 'Custom', score: 1, color: '#000', order: 0 })
    await seedDefaults()
    expect(await db.difficulties.count()).toBe(1)
  })

  it('skips seeding tags when they already exist', async () => {
    await db.tags.add({ id: 'existing-tag', name: 'Custom Tag', color: '#000' })
    await seedDefaults()
    expect(await db.tags.count()).toBe(1)
  })

  it('seeds both independently — tags skipped does not block difficulties', async () => {
    await db.tags.add({ id: 'existing-tag', name: 'Custom', color: '#000' })
    await seedDefaults()
    expect(await db.difficulties.count()).toBeGreaterThanOrEqual(3)
    expect(await db.tags.count()).toBe(1) // not overwritten
  })
})

// ── purgeDatabase ─────────────────────────────────────────────────────────────

describe('purgeDatabase', () => {
  beforeEach(clearAll)

  it('clears all tables', async () => {
    await db.questions.add({ ...BASE_QUESTION, id: 'q1', title: 'Q' })
    await db.rounds.add({ id: 'r1', name: 'R', description: '', questionIds: [], createdAt: 0 })
    await db.tags.add({ id: 't1', name: 'Music', color: '#f00' })
    await db.difficulties.add({ id: 'd1', name: 'Easy', score: 5, color: '#0f0', order: 0 })
    await db.notes.add({ id: 'n1', name: 'N', content: '', createdAt: 0, updatedAt: 0 })

    await purgeDatabase()

    expect(await db.questions.count()).toBe(0)
    expect(await db.rounds.count()).toBe(0)
    expect(await db.tags.count()).toBe(0)
    expect(await db.difficulties.count()).toBe(0)
    expect(await db.notes.count()).toBe(0)
  })

  it('is safe to call on an already-empty database', async () => {
    await expect(purgeDatabase()).resolves.toBeUndefined()
    expect(await db.questions.count()).toBe(0)
  })

  it('re-seeding after purge restores defaults', async () => {
    await db.questions.add({ ...BASE_QUESTION, id: 'q1', title: 'Q' })
    await purgeDatabase()
    await seedDefaults()

    expect(await db.questions.count()).toBe(0) // questions not re-seeded
    expect(await db.difficulties.count()).toBeGreaterThanOrEqual(3)
    expect(await db.tags.count()).toBeGreaterThanOrEqual(8)
  })
})

// ── DB schema ─────────────────────────────────────────────────────────────────

describe('DB schema', () => {
  beforeEach(clearAll)

  it('inserts and retrieves a question', async () => {
    const q: Question = {
      ...BASE_QUESTION,
      id: 'q1',
      title: 'What is 2+2?',
      answer: '4',
    }
    await db.questions.add(q)
    const fetched = await db.questions.get('q1')
    expect(fetched?.title).toBe('What is 2+2?')
    expect(fetched?.answer).toBe('4')
  })

  it('preserves question type and options array', async () => {
    await db.questions.add({
      ...BASE_QUESTION,
      id: 'q2',
      title: 'True or False?',
      type: 'true_false',
      options: ['True', 'False'],
      answer: 'True',
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
    await db.games.add({
      id: 'g1',
      name: 'Test Game',
      status: 'waiting',
      transportMode: 'auto',
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
    })
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
    await db.questions.bulkAdd([
      { ...BASE_QUESTION, id: 'qa', title: 'Q A' },
      { ...BASE_QUESTION, id: 'qb', title: 'Q B' },
      { ...BASE_QUESTION, id: 'qc', title: 'Q C' },
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

// ── importDatabase ────────────────────────────────────────────────────────────

describe('importDatabase', () => {
  beforeEach(clearAll)

  async function makeFile(snapshot: object) {
    return new File([JSON.stringify(snapshot)], 'backup.json', { type: 'application/json' })
  }

  it('throws on unsupported version', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    await expect(importDatabase(await makeFile({ version: 99 }))).rejects.toThrow(
      'Unsupported snapshot version: 99'
    )
  })

  it('accepts version 1 exports (legacy)', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    const now = Date.now()
    await importDatabase(
      await makeFile({
        version: 1,
        exportedAt: now,
        categories: [{ id: 'cat1', name: 'Science', color: '#00f' }], // ignored
        difficulties: [{ id: 'd1', name: 'Easy', score: 5, color: '#0f0', order: 0 }],
        tags: [],
        questions: [],
        rounds: [],
        games: [],
        notes: [],
      })
    )
    expect(await db.difficulties.count()).toBe(1)
  })

  it('accepts version 2 exports', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    const now = Date.now()
    await importDatabase(
      await makeFile({
        version: 2,
        exportedAt: now,
        difficulties: [{ id: 'd1', name: 'Hard', score: 15, color: '#f00', order: 0 }],
        tags: [{ id: 't1', name: 'Music', color: '#00f' }],
        questions: [],
        rounds: [],
        games: [],
        notes: [],
      })
    )
    expect(await db.difficulties.count()).toBe(1)
    expect(await db.tags.count()).toBe(1)
  })

  it('strips categoryId from imported questions', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    const now = Date.now()
    await importDatabase(
      await makeFile({
        version: 1,
        exportedAt: now,
        categories: [],
        difficulties: [],
        tags: [],
        questions: [
          {
            id: 'q1',
            title: 'Q?',
            type: 'open_ended',
            options: [],
            answer: 'A',
            description: '',
            categoryId: 'cat-old',
            difficulty: null,
            tags: [],
            media: null,
            mediaType: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        rounds: [],
        games: [],
        notes: [],
      })
    )
    const q = await db.questions.get('q1')
    expect(q).toBeDefined()
    expect((q as unknown as Record<string, unknown>)['categoryId']).toBeUndefined()
  })

  it('skips bulkPut when collection arrays are empty', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    await importDatabase(
      await makeFile({
        version: 2,
        exportedAt: Date.now(),
        difficulties: [],
        tags: [],
        questions: [],
        rounds: [],
        games: [],
        notes: [],
      })
    )
    expect(await db.difficulties.count()).toBe(0)
    expect(await db.tags.count()).toBe(0)
  })

  it('imports difficulties', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    await importDatabase(
      await makeFile({
        version: 2,
        exportedAt: Date.now(),
        difficulties: [{ id: 'd1', name: 'Hard', score: 15, color: '#c00', order: 0 }],
        tags: [],
        questions: [],
        rounds: [],
        games: [],
        notes: [],
      })
    )
    expect(await db.difficulties.get('d1')).toBeDefined()
  })

  it('imports rounds', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    const now = Date.now()
    await importDatabase(
      await makeFile({
        version: 2,
        exportedAt: now,
        difficulties: [],
        tags: [],
        questions: [],
        rounds: [{ id: 'r1', name: 'R1', description: '', questionIds: [], createdAt: now }],
        games: [],
        notes: [],
      })
    )
    expect(await db.rounds.get('r1')).toBeDefined()
  })

  it('imports games', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    const now = Date.now()
    const game = {
      id: 'g1',
      name: 'G',
      status: 'waiting',
      transportMode: 'auto',
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
      createdAt: now,
      updatedAt: now,
    }
    await importDatabase(
      await makeFile({
        version: 2,
        exportedAt: now,
        difficulties: [],
        tags: [],
        questions: [],
        rounds: [],
        games: [game],
        notes: [],
      })
    )
    expect(await db.games.get('g1')).toBeDefined()
  })

  it('imports tags and questions', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    const now = Date.now()
    await importDatabase(
      await makeFile({
        version: 2,
        exportedAt: now,
        difficulties: [],
        tags: [{ id: 't1', name: 'Music', color: '#00f' }],
        questions: [
          {
            id: 'q1',
            title: 'Q?',
            type: 'open_ended',
            options: [],
            answer: 'A',
            description: '',
            difficulty: null,
            tags: [],
            media: null,
            mediaType: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        rounds: [],
        games: [],
        notes: [],
      })
    )
    expect(await db.tags.get('t1')).toBeDefined()
    expect(await db.questions.get('q1')).toBeDefined()
  })
})

// ── exportDatabase ────────────────────────────────────────────────────────────

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

// ── importQuestions ───────────────────────────────────────────────────────────

describe('importQuestions', () => {
  beforeEach(clearAll)

  async function makeQFile(rows: object[]) {
    return new File([JSON.stringify(rows)], 'questions.json', { type: 'application/json' })
  }

  it('imports a multiple_choice question', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const result = await importQuestions(
      await makeQFile([
        {
          title: 'What is the capital of France?',
          type: 'multiple_choice',
          options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
          answer: 'Paris',
        },
      ])
    )

    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)
    const q = (await db.questions.toArray())[0]
    expect(q.type).toBe('multiple_choice')
    expect(q.options).toEqual(['Berlin', 'Madrid', 'Paris', 'Rome'])
    expect(q.answer).toBe('Paris')
  })

  it('imports a true_false question', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    await importQuestions(
      await makeQFile([
        {
          title: 'The Great Wall is visible from space.',
          type: 'true_false',
          options: ['True', 'False'],
          answer: 'False',
        },
      ])
    )
    const q = (await db.questions.toArray())[0]
    expect(q.type).toBe('true_false')
    expect(q.answer).toBe('False')
  })

  it('imports an open_ended question', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    await importQuestions(
      await makeQFile([
        { title: 'What element has symbol Au?', type: 'open_ended', options: [], answer: 'Gold' },
      ])
    )
    const q = (await db.questions.toArray())[0]
    expect(q.type).toBe('open_ended')
    expect(q.answer).toBe('Gold')
  })

  it('upserts — updates existing question when id matches', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    await db.questions.add({
      ...BASE_QUESTION,
      id: 'q-existing',
      title: 'Old title',
      answer: 'Old',
    })

    await importQuestions(
      await makeQFile([
        {
          id: 'q-existing',
          title: 'Updated title',
          type: 'open_ended',
          options: [],
          answer: 'New',
        },
      ])
    )

    expect(await db.questions.count()).toBe(1)
    const q = await db.questions.get('q-existing')
    expect(q?.title).toBe('Updated title')
    expect(q?.answer).toBe('New')
  })

  it('imports multiple questions in one file', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const result = await importQuestions(
      await makeQFile([
        { title: 'Q1', type: 'open_ended', options: [], answer: 'A1' },
        { title: 'Q2', type: 'true_false', options: ['True', 'False'], answer: 'True' },
        { title: 'Q3', type: 'multiple_choice', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      ])
    )
    expect(result.imported).toBe(3)
    expect(await db.questions.count()).toBe(3)
  })

  it('skips rows with missing title and records an error', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const result = await importQuestions(
      await makeQFile([
        { title: '', type: 'open_ended', options: [], answer: 'A' },
        { title: 'Q2', type: 'open_ended', options: [], answer: 'B' },
      ])
    )
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toContain('Row 1')
  })

  it('throws when file is not a JSON array', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const file = new File(['{"not": "an array"}'], 'q.json', { type: 'application/json' })
    await expect(importQuestions(file)).rejects.toThrow('Expected a JSON array')
  })

  it('handles whitespace-only titles as missing', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const result = await importQuestions(
      await makeQFile([{ title: '   ', type: 'open_ended', options: [], answer: 'A' }])
    )
    expect(result.skipped).toBe(1)
  })

  it('trims whitespace from titles on import', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    await importQuestions(
      await makeQFile([{ title: '  What is 2+2?  ', type: 'open_ended', options: [], answer: '4' }])
    )
    const q = (await db.questions.toArray())[0]
    expect(q.title).toBe('What is 2+2?')
  })

  it('assigns a new uuid when id is omitted', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    await importQuestions(
      await makeQFile([{ title: 'Q', type: 'open_ended', options: [], answer: 'A' }])
    )
    const q = (await db.questions.toArray())[0]
    expect(typeof q.id).toBe('string')
    expect(q.id.length).toBeGreaterThan(0)
  })

  it('continues importing valid rows after a skipped row', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const result = await importQuestions(
      await makeQFile([
        { title: '', type: 'open_ended', options: [], answer: 'A' }, // bad
        { title: 'Q2', type: 'open_ended', options: [], answer: 'B' }, // good
        { title: '', type: 'open_ended', options: [], answer: 'C' }, // bad
        { title: 'Q4', type: 'open_ended', options: [], answer: 'D' }, // good
      ])
    )
    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(2)
  })

  it('preserves tag ids when they are already ids (not names)', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    await db.tags.add({ id: 'tag-music', name: 'Music', color: '#f0f' })
    await importQuestions(
      await makeQFile([
        { title: 'Q', type: 'open_ended', options: [], answer: 'A', tags: ['tag-music'] },
      ])
    )
    const q = (await db.questions.toArray())[0]
    expect(q.tags).toContain('tag-music')
  })
})

// ── exportQuestions ───────────────────────────────────────────────────────────

describe('exportQuestions', () => {
  beforeEach(clearAll)

  async function captureExport(ids?: string[]): Promise<string> {
    let capturedBlob: Blob | null = null
    ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementationOnce((blob: Blob) => {
      capturedBlob = blob
      return 'blob:captured'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { exportQuestions } = await import('@/db/snapshot')
    await exportQuestions(ids)
    return capturedBlob ? await (capturedBlob as Blob).text() : '[]'
  }

  it('exports all questions when no ids provided', async () => {
    await db.questions.bulkAdd([
      { ...BASE_QUESTION, id: 'q1', title: 'Q1' },
      { ...BASE_QUESTION, id: 'q2', title: 'Q2' },
    ])
    const rows = JSON.parse(await captureExport())
    expect(rows).toHaveLength(2)
  })

  it('exports only selected ids when provided', async () => {
    await db.questions.bulkAdd([
      { ...BASE_QUESTION, id: 'q1', title: 'Keep' },
      { ...BASE_QUESTION, id: 'q2', title: 'Skip' },
    ])
    const rows = JSON.parse(await captureExport(['q1']))
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Keep')
  })

  it('exports an empty array when no questions exist', async () => {
    const rows = JSON.parse(await captureExport())
    expect(rows).toEqual([])
  })

  it('round-trips: export then import preserves core fields', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    await db.questions.add({
      ...BASE_QUESTION,
      id: 'q-rt',
      title: 'Round-trip question',
      type: 'multiple_choice',
      options: ['A', 'B', 'C', 'D'],
      answer: 'C',
      description: 'Test desc',
      tags: [],
    })

    const json = await captureExport()
    await db.questions.clear()
    const file = new File([json], 'export.json', { type: 'application/json' })
    const result = await importQuestions(file)

    expect(result.imported).toBe(1)
    const restored = await db.questions.get('q-rt')
    expect(restored?.title).toBe('Round-trip question')
    expect(restored?.options).toEqual(['A', 'B', 'C', 'D'])
    expect(restored?.answer).toBe('C')
  })
})

// ── downloadExampleQuestions ──────────────────────────────────────────────────

describe('downloadExampleQuestions', () => {
  it('triggers a download', async () => {
    const { downloadExampleQuestions } = await import('@/db/snapshot')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadExampleQuestions()
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})
