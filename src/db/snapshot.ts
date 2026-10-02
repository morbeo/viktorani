import type { z } from 'zod'
import { db } from '@/db'
import type { DifficultyLevel, Tag, Question, Round, Game, GameQuestion, Note } from '@/db'
import { SnapshotSchema, QuestionImportRowSchema } from '@/db/snapshot-schema'

/**
 * Full database snapshot used for backup and restore.
 *
 * @remarks
 * Version history:
 * - **v1**: Included a `categories` array (now ignored on import).
 * - **v2**: Categories removed; tags are the sole classifier. `gameQuestions` was
 *   added later; older v2 files without it restore games with no questions.
 *
 * `gameQuestions` is included because it defines which questions each game plays.
 * Runtime-only collections (`players`, `teams`, `buzzEvents`, `scoreEvents`, `timers`,
 * `layouts`, `widgets`) are intentionally excluded — they represent transient session state
 * that is not meaningful to restore.
 */
export interface DatabaseSnapshot {
  version: number
  exportedAt: number
  difficulties: DifficultyLevel[]
  tags: Tag[]
  questions: Question[]
  rounds: Round[]
  games: Game[]
  gameQuestions: GameQuestion[]
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
    gameQuestions: await db.gameQuestions.toArray(),
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

/** Largest import file accepted by {@link importDatabase} and {@link importQuestions}. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024

/** Reject oversized files, then read and parse the file as JSON. */
async function readJsonFile(file: File): Promise<unknown> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`File is too large (max ${MAX_IMPORT_BYTES / 1024 / 1024} MB)`)
  }
  const text = await file.text()
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`, { cause: e })
  }
}

/** Human-readable summary of the first few zod issues, e.g. `games.0.roundIds: ...`. */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ')
}

/**
 * Restore a previously exported snapshot into the local database.
 *
 * @remarks
 * The whole file is validated before anything is written; all collections are
 * then written with `bulkPut` in a single transaction, so an invalid file or a
 * failed write leaves the database untouched. Existing records with matching IDs
 * are overwritten. Accepts both v1 (with categories) and v2 snapshots —
 * `categories` and legacy `categoryId` fields are stripped transparently.
 *
 * @param file - A `.json` file previously produced by {@link exportDatabase}.
 * @throws If the file is too large, not valid JSON, has an unsupported snapshot
 *   version, or contains malformed records.
 */
export async function importDatabase(file: File): Promise<void> {
  const raw = await readJsonFile(file)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid backup file: expected a JSON object')
  }

  const version = (raw as { version?: unknown }).version
  if (version !== 1 && version !== 2) {
    throw new Error(`Unsupported snapshot version: ${version}`)
  }

  const parsed = SnapshotSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`Invalid backup file: ${formatIssues(parsed.error)}`)
  const snapshot = parsed.data

  await db.transaction(
    'rw',
    [db.difficulties, db.tags, db.questions, db.rounds, db.games, db.gameQuestions, db.notes],
    async () => {
      if (snapshot.difficulties.length) await db.difficulties.bulkPut(snapshot.difficulties)
      if (snapshot.tags.length) await db.tags.bulkPut(snapshot.tags)
      if (snapshot.questions.length) await db.questions.bulkPut(snapshot.questions)
      if (snapshot.rounds.length) await db.rounds.bulkPut(snapshot.rounds)
      if (snapshot.games.length) await db.games.bulkPut(snapshot.games)
      if (snapshot.gameQuestions.length) await db.gameQuestions.bulkPut(snapshot.gameQuestions)
      if (snapshot.notes.length) await db.notes.bulkPut(snapshot.notes)
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

/**
 * Import questions from a JSON array file into the question bank.
 *
 * @remarks
 * Each element must be an object with at least `title`, `type` (a valid
 * question type) and `answer`; `options`, when present, must be a string array.
 * Invalid rows are skipped and reported in `errors`. All rows are validated
 * first, then the valid ones are written with a single `bulkPut` in one
 * transaction, so a failed write imports nothing. Existing records with a
 * matching `id` are updated.
 *
 * @param file - A `.json` file containing an array of partial {@link Question} objects.
 * @returns A summary with counts of imported, skipped, and error rows.
 * @throws If the file is too large, not valid JSON, not a JSON array, or the write fails.
 *
 * @example
 * ```ts
 * const result = await importQuestions(file)
 * console.log(`Imported ${result.imported}, skipped ${result.skipped}`)
 * ```
 */
export async function importQuestions(file: File): Promise<ImportResult> {
  const raw = await readJsonFile(file)
  if (!Array.isArray(raw)) throw new Error('Invalid JSON: Expected a JSON array')

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const now = Date.now()
  const questions: Question[] = []

  raw.forEach((row, i) => {
    const parsed = QuestionImportRowSchema.safeParse(row)
    if (!parsed.success) {
      const messages = new Set(parsed.error.issues.map(issue => issue.message))
      result.errors.push(`Row ${i + 1}: ${[...messages].join(', ')}`)
      result.skipped++
      return
    }
    const r = parsed.data
    questions.push({
      ...r,
      id: r.id ?? crypto.randomUUID(),
      title: r.title.trim(),
      createdAt: r.createdAt ?? now,
      updatedAt: now,
    })
  })

  if (questions.length) {
    await db.transaction('rw', db.questions, () => db.questions.bulkPut(questions))
  }
  result.imported = questions.length
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

// ── Notes import/export ───────────────────────────────────────────────────────

/**
 * Export a single note as a `.md` file download.
 */
export function exportNote(note: Note): void {
  const blob = new Blob([note.content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = note.name.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'note'
  a.download = `${safeName}.md`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Read a `.md` file as plaintext for use as note content.
 */
export async function importNoteFile(file: File): Promise<{ name: string; content: string }> {
  const raw = await file.text()
  const content = raw
  const name = file.name.replace(/\.md$/i, '').replace(/[-_]/g, ' ').trim() || 'Imported note'
  return { name, content }
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
