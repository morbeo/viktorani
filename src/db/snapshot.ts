import { db } from '@/db'
import type { Category, DifficultyLevel, Tag, Question, Round, Game, Note } from '@/db'

export interface DatabaseSnapshot {
  version: number
  exportedAt: number
  categories: Category[]
  difficulties: DifficultyLevel[]
  tags: Tag[]
  questions: Question[]
  rounds: Round[]
  games: Game[]
  notes: Note[]
}

export async function exportDatabase(): Promise<void> {
  const snapshot: DatabaseSnapshot = {
    version: 1,
    exportedAt: Date.now(),
    categories: await db.categories.toArray(),
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
  const snapshot = JSON.parse(text) as DatabaseSnapshot

  if (snapshot.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${snapshot.version}`)
  }

  // Merge — existing records with same ID are overwritten
  await db.transaction(
    'rw',
    [db.categories, db.difficulties, db.tags, db.questions, db.rounds, db.games, db.notes],
    async () => {
      if (snapshot.categories?.length) await db.categories.bulkPut(snapshot.categories)
      if (snapshot.difficulties?.length) await db.difficulties.bulkPut(snapshot.difficulties)
      if (snapshot.tags?.length) await db.tags.bulkPut(snapshot.tags)
      if (snapshot.questions?.length) await db.questions.bulkPut(snapshot.questions)
      if (snapshot.rounds?.length) await db.rounds.bulkPut(snapshot.rounds)
      if (snapshot.games?.length) await db.games.bulkPut(snapshot.games)
      if (snapshot.notes?.length) await db.notes.bulkPut(snapshot.notes)
    }
  )
}

// ── Question bulk import/export ───────────────────────────────────────────────

export interface QuestionExportRow {
  id?: string
  title: string
  type: 'multiple_choice' | 'true_false' | 'open_ended'
  options: string[] // MC: 4 items; TF: ['True','False']; OE: []
  answer: string // MC: exact option text; TF: 'True'|'False'; OE: expected answer
  description?: string
  category?: string // category name (matched by name on import)
  difficulty?: string // difficulty name (matched by name on import)
  tags?: string[] // tag names (matched by name on import)
}

export const QUESTION_EXAMPLES: QuestionExportRow[] = [
  {
    title: 'What is the capital of France?',
    type: 'multiple_choice',
    options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
    answer: 'Paris',
    description: 'European capitals question.',
    category: 'Geography',
    difficulty: 'Easy',
    tags: ['Geography'],
  },
  {
    title: 'The Great Wall of China is visible from space.',
    type: 'true_false',
    options: ['True', 'False'],
    answer: 'False',
    description: 'Common myth — it is not visible from low Earth orbit with the naked eye.',
    category: 'Science',
    difficulty: 'Medium',
    tags: ['Science', 'History'],
  },
  {
    title: 'What element has the chemical symbol Au?',
    type: 'open_ended',
    options: [],
    answer: 'Gold',
    description: 'From the Latin "aurum".',
    category: 'Science',
    difficulty: 'Hard',
    tags: ['Science'],
  },
]

export async function exportQuestions(ids?: string[]): Promise<void> {
  const questions: Question[] = ids?.length
    ? (await db.questions.bulkGet(ids)).filter((q): q is Question => q !== undefined)
    : await db.questions.toArray()

  const [categories, difficulties, tags] = await Promise.all([
    db.categories.toArray(),
    db.difficulties.toArray(),
    db.tags.toArray(),
  ])

  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const diffMap = Object.fromEntries(difficulties.map(d => [d.id, d.name]))
  const tagMap = Object.fromEntries(tags.map(t => [t.id, t.name]))

  const rows: QuestionExportRow[] = questions.map(q => ({
    id: q.id,
    title: q.title,
    type: q.type,
    options: q.options,
    answer: q.answer,
    description: q.description || undefined,
    category: q.categoryId ? catMap[q.categoryId] : undefined,
    difficulty: q.difficulty ? diffMap[q.difficulty] : undefined,
    tags: q.tags.map(tid => tagMap[tid]).filter(Boolean),
  }))

  const label = ids?.length ? `${ids.length}-questions` : 'all-questions'
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `viktorani-${label}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function importQuestions(file: File): Promise<ImportResult> {
  const text = await file.text()
  const rows = JSON.parse(text) as QuestionExportRow[]

  if (!Array.isArray(rows)) throw new Error('Expected a JSON array of questions.')

  const [categories, difficulties, tags] = await Promise.all([
    db.categories.toArray(),
    db.difficulties.toArray(),
    db.tags.toArray(),
  ])

  const catByName = Object.fromEntries(categories.map(c => [c.name.toLowerCase(), c.id]))
  const diffByName = Object.fromEntries(difficulties.map(d => [d.name.toLowerCase(), d.id]))
  const tagByName = Object.fromEntries(tags.map(t => [t.name.toLowerCase(), t.id]))

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const now = Date.now()

  for (const [i, row] of rows.entries()) {
    try {
      if (!row.title?.trim()) {
        result.errors.push(`Row ${i + 1}: missing title`)
        result.skipped++
        continue
      }
      if (!['multiple_choice', 'true_false', 'open_ended'].includes(row.type)) {
        result.errors.push(`Row ${i + 1}: invalid type "${row.type}"`)
        result.skipped++
        continue
      }

      const q: Question = {
        id: row.id ?? crypto.randomUUID(),
        title: row.title.trim(),
        type: row.type,
        options: row.options ?? [],
        answer: row.answer ?? '',
        description: row.description ?? '',
        categoryId: row.category ? (catByName[row.category.toLowerCase()] ?? null) : null,
        difficulty: row.difficulty ? (diffByName[row.difficulty.toLowerCase()] ?? null) : null,
        tags: (row.tags ?? []).map(t => tagByName[t.toLowerCase()]).filter(Boolean),
        media: null,
        mediaType: null,
        createdAt: now,
        updatedAt: now,
      }

      await db.questions.put(q) // put = upsert (updates if id exists)
      result.imported++
    } catch (err) {
      result.errors.push(`Row ${i + 1}: ${(err as Error).message}`)
      result.skipped++
    }
  }

  return result
}

export function downloadExampleQuestions(): void {
  const blob = new Blob([JSON.stringify(QUESTION_EXAMPLES, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'viktorani-questions-example.json'
  a.click()
  URL.revokeObjectURL(url)
}
