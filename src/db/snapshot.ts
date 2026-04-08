import { db } from '@/db'
import type { DifficultyLevel, Tag, Question, Round, Game, Note } from '@/db'

export interface DatabaseSnapshot {
  version: number
  exportedAt: number
  difficulties: DifficultyLevel[]
  tags: Tag[]
  questions: Question[]
  rounds: Round[]
  games: Game[]
  notes: Note[]
}

export async function exportDatabase(): Promise<void> {
  const snapshot: DatabaseSnapshot = {
    version: 2,
    exportedAt: Date.now(),
    difficulties: await db.difficulties.toArray(),
    tags: await db.tags.toArray(),
    questions: await db.questions.toArray(),
    rounds: await db.rounds.toArray(),
    games: await db.games.toArray(),
    notes: await db.notes.toArray(),
  }

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `viktorani-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importDatabase(file: File): Promise<void> {
  const text = await file.text()
  const snapshot = JSON.parse(text) as DatabaseSnapshot & {
    categories?: unknown[] // accepted but ignored from v1 exports
  }

  if (snapshot.version !== 1 && snapshot.version !== 2) {
    throw new Error(`Unsupported snapshot version: ${snapshot.version}`)
  }

  await db.transaction(
    'rw',
    [db.difficulties, db.tags, db.questions, db.rounds, db.games, db.notes],
    async () => {
      if (snapshot.difficulties?.length) await db.difficulties.bulkPut(snapshot.difficulties)
      if (snapshot.tags?.length) await db.tags.bulkPut(snapshot.tags)
      if (snapshot.questions?.length) {
        // Strip legacy categoryId if present
        const cleaned = snapshot.questions.map((q: Question & { categoryId?: unknown }) => {
          const { categoryId: _dropped, ...rest } = q as Question & { categoryId?: unknown }
          void _dropped
          return rest as Question
        })
        await db.questions.bulkPut(cleaned)
      }
      if (snapshot.rounds?.length) await db.rounds.bulkPut(snapshot.rounds)
      if (snapshot.games?.length) await db.games.bulkPut(snapshot.games)
      if (snapshot.notes?.length) await db.notes.bulkPut(snapshot.notes)
    }
  )
}

// ── Questions import/export ───────────────────────────────────────────────────

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

const REQUIRED_FIELDS = ['title', 'type', 'answer'] as const

export async function importQuestions(file: File): Promise<ImportResult> {
  const text = await file.text()
  let raw: unknown[]
  try {
    raw = JSON.parse(text)
    if (!Array.isArray(raw)) throw new Error('Expected a JSON array')
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`)
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const now = Date.now()

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as Record<string, unknown>
    const missing = REQUIRED_FIELDS.filter(f => !String(row[f] ?? '').trim())
    if (missing.length) {
      result.errors.push(`Row ${i + 1}: missing ${missing.join(', ')}`)
      result.skipped++
      continue
    }

    try {
      const title = String(row.title).trim()
      const q: Question = {
        id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
        title,
        type: (row.type as Question['type']) ?? 'open_ended',
        options: Array.isArray(row.options) ? (row.options as string[]) : [],
        answer: String(row.answer),
        description: typeof row.description === 'string' ? row.description : '',
        difficulty: typeof row.difficulty === 'string' ? row.difficulty : null,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        media: typeof row.media === 'string' ? row.media : null,
        mediaType: (row.mediaType as Question['mediaType']) ?? null,
        createdAt: typeof row.createdAt === 'number' ? row.createdAt : now,
        updatedAt: now,
      }
      await db.questions.put(q)
      result.imported++
    } catch (e) {
      result.errors.push(`Row ${i + 1}: ${(e as Error).message}`)
      result.skipped++
    }
  }

  return result
}

export async function exportQuestions(ids?: string[]): Promise<void> {
  const questions = ids?.length
    ? await db.questions.bulkGet(ids).then(qs => qs.filter(Boolean) as Question[])
    : await db.questions.toArray()

  const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `viktorani-questions-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadExampleQuestions(): void {
  const example: Partial<Question>[] = [
    {
      title: 'What is the capital of France?',
      type: 'multiple_choice',
      options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
      answer: 'Paris',
      description: 'European geography',
      difficulty: null,
      tags: [],
    },
    {
      title: 'Is the Great Wall of China visible from space?',
      type: 'true_false',
      options: ['True', 'False'],
      answer: 'False',
      description: 'Common myth — not visible with the naked eye.',
      difficulty: null,
      tags: [],
    },
    {
      title: 'Who wrote Hamlet?',
      type: 'open_ended',
      options: [],
      answer: 'Shakespeare',
      difficulty: null,
      tags: [],
    },
  ]
  const blob = new Blob([JSON.stringify(example, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'viktorani-questions-example.json'
  a.click()
  URL.revokeObjectURL(url)
}
