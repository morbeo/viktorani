// @vitest-pool vmForks
// Companion to src/test/db.test.ts — covers remaining branches in snapshot.ts:
//   - importQuestions per-row catch() (lines 119-120)
//   - importQuestions field coercions: missing id, non-array options/tags,
//     non-string difficulty/media (lines 93, 103, 106, 109, 111)
//   - importDatabase notes bulk-put path (line 63)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'

beforeEach(async () => {
  await db.questions.clear()
})

describe('importQuestions — per-row db error path', () => {
  it('records a skipped row when db.questions.put throws', async () => {
    const { importQuestions } = await import('@/db/snapshot')

    // Force db.questions.put to throw on first call, succeed on second
    const putSpy = vi
      .spyOn(db.questions, 'put')
      .mockRejectedValueOnce(new Error('Constraint violation'))
      .mockResolvedValue('q2')

    const rows = [
      {
        id: 'q1',
        title: 'Failing row',
        type: 'open_ended',
        options: [],
        answer: 'A',
        description: '',
        difficulty: null,
        tags: [],
        media: null,
        mediaType: null,
        createdAt: Date.now(),
      },
      {
        id: 'q2',
        title: 'Good row',
        type: 'open_ended',
        options: [],
        answer: 'B',
        description: '',
        difficulty: null,
        tags: [],
        media: null,
        mediaType: null,
        createdAt: Date.now(),
      },
    ]

    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    const result = await importQuestions(file)

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/Row 1/)
    expect(result.errors[0]).toMatch(/Constraint violation/)

    putSpy.mockRestore()
  })
})

// ── importQuestions field coercions ───────────────────────────────────────────
// Each branch below exercises an else-arm that the happy-path row (which has
// all fields present and correctly typed) never reaches.

describe('importQuestions — field coercions', () => {
  it('generates a uuid when row.id is not a string', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const rows = [{ title: 'Q', type: 'open_ended', answer: 'A', id: 42 }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    const result = await importQuestions(file)
    expect(result.imported).toBe(1)
    const all = await db.questions.toArray()
    expect(all[0].id).toMatch(/^[0-9a-f-]{36}$/) // UUID format
  })

  it('defaults options to [] when row.options is not an array', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const rows = [{ title: 'Q', type: 'open_ended', answer: 'A', options: 'wrong' }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    await importQuestions(file)
    const all = await db.questions.toArray()
    expect(all[0].options).toEqual([])
  })

  it('defaults difficulty to null when row.difficulty is not a string', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const rows = [{ title: 'Q', type: 'open_ended', answer: 'A', difficulty: 99 }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    await importQuestions(file)
    const all = await db.questions.toArray()
    expect(all[0].difficulty).toBeNull()
  })

  it('defaults tags to [] when row.tags is not an array', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const rows = [{ title: 'Q', type: 'open_ended', answer: 'A', tags: 'bad' }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    await importQuestions(file)
    const all = await db.questions.toArray()
    expect(all[0].tags).toEqual([])
  })

  it('defaults media to null when row.media is not a string', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const rows = [{ title: 'Q', type: 'open_ended', answer: 'A', media: 123 }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    await importQuestions(file)
    const all = await db.questions.toArray()
    expect(all[0].media).toBeNull()
  })
})

// ── importDatabase notes path ──────────────────────────────────────────────────

describe('importDatabase — notes bulk-put', () => {
  it('imports notes when snapshot contains them', async () => {
    const { importDatabase } = await import('@/db/snapshot')
    await db.notes.clear()
    const now = Date.now()
    await importDatabase(
      new File(
        [
          JSON.stringify({
            version: 2,
            exportedAt: now,
            difficulties: [],
            tags: [],
            questions: [],
            rounds: [],
            games: [],
            notes: [
              { id: 'n1', name: 'My note', content: '# Hello', createdAt: now, updatedAt: now },
            ],
          }),
        ],
        'snap.json',
        { type: 'application/json' }
      )
    )
    expect(await db.notes.get('n1')).toBeDefined()
  })
})
