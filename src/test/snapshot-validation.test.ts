// @vitest-pool vmForks
// Malformed-input handling for importDatabase / importQuestions (#259):
// validation happens before any write, and writes are all-or-nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'
import { importDatabase, importQuestions, MAX_IMPORT_BYTES } from '@/db/snapshot'

const now = 1_700_000_000_000

const DIFFICULTY = { id: 'd1', name: 'Easy', score: 5, color: '#0f0', order: 0 }

const GAME = {
  id: 'g1',
  name: 'G',
  status: 'waiting',
  transportMode: 'auto',
  roomId: null,
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
  buzzerLocked: true,
  scoringEnabled: true,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly',
  tiebreakerMode: 'serverOrder',
  createdAt: now,
  updatedAt: now,
}

function jsonFile(value: unknown, name = 'backup.json') {
  return new File([JSON.stringify(value)], name, { type: 'application/json' })
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    exportedAt: now,
    difficulties: [DIFFICULTY],
    tags: [],
    questions: [],
    rounds: [],
    games: [GAME],
    notes: [],
    ...overrides,
  }
}

beforeEach(async () => {
  await Promise.all([db.difficulties.clear(), db.games.clear(), db.questions.clear()])
})

describe('importDatabase — validation', () => {
  it('rejects a JSON null with a clear error', async () => {
    await expect(importDatabase(jsonFile(null))).rejects.toThrow(
      'Invalid backup file: expected a JSON object'
    )
  })

  it('rejects a game without roundIds and writes nothing', async () => {
    const { roundIds: _omit, ...game } = GAME
    void _omit
    await expect(importDatabase(jsonFile(snapshot({ games: [game] })))).rejects.toThrow(
      /games\.0\.roundIds/
    )
    expect(await db.difficulties.count()).toBe(0)
    expect(await db.games.count()).toBe(0)
  })

  it('rejects a question with an invalid type', async () => {
    const question = {
      id: 'q1',
      title: 'Q',
      type: 'essay',
      options: [],
      answer: 'A',
      description: '',
      difficulty: null,
      tags: [],
      media: null,
      mediaType: null,
      createdAt: now,
      updatedAt: now,
    }
    await expect(importDatabase(jsonFile(snapshot({ questions: [question] })))).rejects.toThrow(
      /questions\.0\.type/
    )
    expect(await db.difficulties.count()).toBe(0)
  })

  it('rejects oversized files', async () => {
    const file = jsonFile(snapshot())
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_BYTES + 1 })
    await expect(importDatabase(file)).rejects.toThrow('File is too large')
    expect(await db.difficulties.count()).toBe(0)
  })

  it('rolls back earlier collections when a later write fails', async () => {
    const spy = vi.spyOn(db.games, 'bulkPut').mockRejectedValueOnce(new Error('disk full'))
    await expect(importDatabase(jsonFile(snapshot()))).rejects.toThrow('disk full')
    expect(await db.difficulties.count()).toBe(0)
    spy.mockRestore()
  })

  it('imports a valid snapshot', async () => {
    await importDatabase(jsonFile(snapshot()))
    expect(await db.difficulties.get('d1')).toEqual(DIFFICULTY)
    expect(await db.games.get('g1')).toEqual(GAME)
  })
})

describe('importQuestions — validation', () => {
  it('rejects oversized files', async () => {
    const file = jsonFile([], 'q.json')
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_BYTES + 1 })
    await expect(importQuestions(file)).rejects.toThrow('File is too large')
  })

  it('skips null and invalid-type rows without aborting the import', async () => {
    const result = await importQuestions(
      jsonFile(
        [
          null,
          { title: 'Bad', type: 'essay', answer: 'A' },
          { title: 'Good', type: 'open_ended', answer: 'B' },
        ],
        'q.json'
      )
    )
    expect(result).toEqual({
      imported: 1,
      skipped: 2,
      errors: ['Row 1: expected an object', 'Row 2: invalid type'],
    })
    expect((await db.questions.toArray()).map(q => q.title)).toEqual(['Good'])
  })

  it('reports all missing required fields for a row', async () => {
    const result = await importQuestions(jsonFile([{ options: [] }], 'q.json'))
    expect(result.errors).toEqual(['Row 1: missing title, missing type, missing answer'])
    expect(await db.questions.count()).toBe(0)
  })
})
