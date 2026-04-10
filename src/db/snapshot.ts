import { db } from '@/db'
import type { DifficultyLevel, Tag, Question, Round, Game, Note } from '@/db'

/**
 * Full database snapshot used for backup and restore.
 *
 * @remarks
 * Version history:
 * - **v1**: Included a `categories` array (now ignored on import).
 * - **v2**: Categories removed; tags are the sole classifier.
 *
 * Runtime-only collections (`players`, `teams`, `buzzEvents`, `timers`,
 * `gameQuestions`, `layouts`, `widgets`) are intentionally excluded —
 * they represent transient session state that is not meaningful to restore.
 */
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

/**
 * Serialise the question bank and game definitions to a JSON file download.
 *
 * @remarks
 * Triggers a browser file-save dialog. The downloaded file can be imported
 * on another device via {@link importDatabase}.
 */
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

/**
 * Restore a previously exported snapshot into the local database.
 *
 * @remarks
 * Uses `bulkPut` so existing records with matching IDs are overwritten.
 * Accepts both v1 (with categories) and v2 snapshots — `categoryId` fields
 * are stripped from question records transparently.
 *
 * @param file - A `.json` file previously produced by {@link exportDatabase}.
 * @throws If the file contains an unsupported snapshot version.
 */
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

/** Summary returned by {@link importQuestions} after processing a file. */
export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

const REQUIRED_FIELDS = ['title', 'type', 'answer'] as const

/**
 * Import questions from a JSON array file into the question bank.
 *
 * @remarks
 * Each element must have at least `title`, `type`, and `answer`.
 * Rows missing required fields are skipped and reported in `errors`.
 * Uses `db.questions.put` so existing records with matching `id` are updated.
 *
 * @param file - A `.json` file containing an array of partial {@link Question} objects.
 * @returns A summary with counts of imported, skipped, and error rows.
 * @throws If the file is not valid JSON or is not a JSON array.
 *
 * @example
 * ```ts
 * const result = await importQuestions(file)
 * console.log(`Imported ${result.imported}, skipped ${result.skipped}`)
 * ```
 */
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

/**
 * Export selected questions (or all questions) to a JSON file download.
 *
 * @param ids - Optional array of question IDs to export. Exports all if omitted.
 */
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

/**
 * Download a small example questions file to help users understand the import format.
 * Contains one question of each type: multiple choice, true/false, and open-ended.
 */
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
