// @vitest-pool vmForks
// Companion to src/test/db.test.ts — covers the per-row catch() branch in
// importQuestions (snapshot.ts lines 119-120) that fires when db.questions.put
// throws for an individual row.
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
