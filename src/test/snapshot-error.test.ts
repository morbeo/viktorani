// @vitest-pool vmForks
// Companion to src/test/db.test.ts — covers remaining branches in snapshot.ts:
//   - importQuestions write failure (single transaction, nothing written)
//   - importQuestions field coercions: missing id, non-array tags,
//     non-string difficulty/media; non-array options are rejected
//   - importDatabase notes bulk-put path (line 63)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'

beforeEach(async () => {
  await db.questions.clear()
})

describe('importQuestions — write failure', () => {
  it('rejects and writes nothing when bulkPut throws', async () => {
    const { importQuestions } = await import('@/db/snapshot')

    const putSpy = vi
      .spyOn(db.questions, 'bulkPut')
      .mockRejectedValueOnce(new Error('Constraint violation'))

    const rows = [
      { id: 'q1', title: 'Row 1', type: 'open_ended', options: [], answer: 'A' },
      { id: 'q2', title: 'Row 2', type: 'open_ended', options: [], answer: 'B' },
    ]

    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    await expect(importQuestions(file)).rejects.toThrow('Constraint violation')
    expect(await db.questions.count()).toBe(0)

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

  it('skips the row when row.options is not an array', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const rows = [{ title: 'Q', type: 'open_ended', answer: 'A', options: 'wrong' }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    const result = await importQuestions(file)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toMatch(/options must be an array of strings/)
    expect(await db.questions.count()).toBe(0)
  })

  it('defaults options to [] when row.options is omitted', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const rows = [{ title: 'Q', type: 'open_ended', answer: 'A' }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    await importQuestions(file)
    const all = await db.questions.toArray()
    expect(all[0].options).toEqual([])
  })

  it('defaults difficulty to null when row.difficulty is not a string', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    // Pass difficulty as a number — hits the `else null` branch on line 109
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
    // Pass media as a number — hits the `else null` branch on line 111
    const rows = [{ title: 'Q', type: 'open_ended', answer: 'A', media: 123 }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    await importQuestions(file)
    const all = await db.questions.toArray()
    expect(all[0].media).toBeNull()
  })

  it('records missing fields when row has null required values', async () => {
    const { importQuestions } = await import('@/db/snapshot')
    const rows = [{ title: null, type: 'open_ended', answer: 'A' }]
    const file = new File([JSON.stringify(rows)], 'q.json', { type: 'application/json' })
    const result = await importQuestions(file)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toMatch(/missing title/)
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
