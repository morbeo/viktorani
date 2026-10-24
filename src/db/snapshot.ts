import type { Table } from 'dexie'
import type { z } from 'zod'
import { db } from '@/db'
import type {
  DifficultyLevel,
  Tag,
  Question,
  Round,
  Game,
  GameQuestion,
  Note,
  Layout,
  Theme,
  Widget,
} from '@/db'
import { SnapshotSchema, QuestionImportRowSchema } from '@/db/snapshot-schema'
import { getSettings, setSettings } from '@/lib/app-settings'
import type { AppSettings } from '@/lib/app-settings'

/**
 * Full database snapshot used for backup and restore.
 *
 * @remarks
 * Version history:
 * - **v1**: Included a `categories` array (now ignored on import).
 * - **v2**: Categories removed; tags are the sole classifier. `gameQuestions` was
 *   added later; older v2 files without it restore games with no questions. `settings`
 *   (the app preferences) was added later still; files without it leave them unchanged.
 *   `layouts` and `widgets` (layout model v2, #409) came next; files without them restore
 *   no layouts. `themes` (the host's own themes, ADR 0022) came after that; files without
 *   them restore none.
 *
 * `gameQuestions` is included because it defines which questions each game plays, and
 * `layouts` / `widgets` / `themes` because they are designed by the host, not produced by
 * play. Built-in themes live in code and are never exported.
 * Runtime-only collections (`players`, `teams`, `buzzEvents`, `answers`, `scoreEvents`,
 * `gameLog`, `timers`) are intentionally excluded — they represent transient session state that is
 * not meaningful to restore. A game's log is downloaded from the game
 * master view instead.
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
  layouts: Layout[]
  widgets: Widget[]
  themes: Theme[]
  settings?: AppSettings
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
    layouts: await db.layouts.toArray(),
    widgets: await db.widgets.toArray(),
    themes: await db.themes.toArray(),
    settings: getSettings(),
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

/** A backup file after validation: every collection present, legacy fields stripped. */
export type ParsedSnapshot = z.output<typeof SnapshotSchema>

/**
 * How {@link applySnapshot} treats rows that are in the database but not in the file.
 * `merge` keeps them; `replace` deletes them, so the database ends up matching the file.
 */
export type ImportMode = 'merge' | 'replace'

/** The collections a snapshot carries, in the order they are written. */
const SNAPSHOT_TABLES = [
  'difficulties',
  'tags',
  'questions',
  'rounds',
  'games',
  'gameQuestions',
  'notes',
  'layouts',
  'widgets',
  'themes',
] as const

type SnapshotTable = (typeof SNAPSHOT_TABLES)[number]

/** The Dexie table behind a collection name, read off `db` so test spies on it apply. */
function table(name: SnapshotTable | (typeof PLAY_TABLES)[number]): Table<{ id: string }, string> {
  return db[name] as unknown as Table<{ id: string }, string>
}

/** Play data that belongs to a game and is not in snapshots. A replace drops it with the game. */
const PLAY_TABLES = [
  'teams',
  'players',
  'buzzEvents',
  'answers',
  'scoreEvents',
  'gameLog',
  'timers',
] as const

/** What a replace import would remove from one collection. */
export interface RemovalGroup {
  /** The collection, e.g. `questions`. */
  table: SnapshotTable
  /** How many rows would be removed. */
  count: number
  /** Names or titles of the removed rows, for collections the host recognises by name. */
  names: string[]
}

/** Collections listed by name in a removal preview; the rest only count. */
const NAMED_TABLES: Partial<Record<SnapshotTable, 'name' | 'title'>> = {
  difficulties: 'name',
  tags: 'name',
  questions: 'title',
  rounds: 'name',
  games: 'name',
  notes: 'name',
  layouts: 'name',
  themes: 'name',
}

/**
 * Read and validate a backup file without writing anything.
 *
 * @remarks
 * Accepts both v1 (with categories) and v2 snapshots: `categories` and legacy
 * `categoryId` fields are stripped.
 *
 * @param file - A `.json` file previously produced by {@link exportDatabase}.
 * @throws If the file is too large, not valid JSON, has an unsupported snapshot
 *   version, or contains malformed records.
 */
export async function readSnapshot(file: File): Promise<ParsedSnapshot> {
  return parseSnapshot(await readJsonFile(file))
}

/**
 * Validate an already-parsed backup object.
 *
 * @throws If the version is unsupported or any record is malformed.
 */
export function parseSnapshot(raw: unknown): ParsedSnapshot {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid backup file: expected a JSON object')
  }

  const version = (raw as { version?: unknown }).version
  if (version !== 1 && version !== 2) {
    throw new Error(`Unsupported snapshot version: ${version}`)
  }

  const parsed = SnapshotSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`Invalid backup file: ${formatIssues(parsed.error)}`)
  return parsed.data
}

/** Ids in each snapshot collection that the database has and the file doesn't. */
async function missingIds(snapshot: ParsedSnapshot): Promise<Record<SnapshotTable, string[]>> {
  const result = {} as Record<SnapshotTable, string[]>
  for (const t of SNAPSHOT_TABLES) {
    const keep = new Set(snapshot[t].map(row => row.id))
    const ids = await table(t).toCollection().primaryKeys()
    result[t] = ids.filter(id => !keep.has(id))
  }
  return result
}

/**
 * List what a `replace` import of `snapshot` would remove, without writing anything.
 *
 * @remarks
 * Only collections that lose rows are returned. Removing a game also removes its play
 * data (players, teams, buzzes, answers, scores, log and timers), which is not listed.
 */
export async function previewReplace(snapshot: ParsedSnapshot): Promise<RemovalGroup[]> {
  const missing = await missingIds(snapshot)
  const groups: RemovalGroup[] = []
  for (const t of SNAPSHOT_TABLES) {
    const ids = missing[t]
    if (!ids.length) continue
    const field = NAMED_TABLES[t]
    const rows = (field ? await table(t).bulkGet(ids) : []) as (
      Record<string, unknown> | undefined
    )[]
    const names = field ? rows.map(row => String(row?.[field] ?? '')) : []
    groups.push({ table: t, count: ids.length, names })
  }
  return groups
}

/**
 * Write a validated snapshot to the local database.
 *
 * @remarks
 * Everything runs in one transaction, so a failed write leaves the database untouched.
 * Rows with matching ids are overwritten. In `replace` mode, rows the file doesn't have
 * are deleted first, along with the play data of every removed game; built-in themes
 * live in code and are unaffected. App settings in the file replace the current ones in
 * either mode.
 *
 * @param snapshot - Output of {@link readSnapshot} or {@link parseSnapshot}.
 * @param mode - `merge` (default) keeps rows missing from the file; `replace` deletes them.
 */
export async function applySnapshot(
  snapshot: ParsedSnapshot,
  mode: ImportMode = 'merge'
): Promise<void> {
  const tables = mode === 'replace' ? [...SNAPSHOT_TABLES, ...PLAY_TABLES] : SNAPSHOT_TABLES
  await db.transaction('rw', tables.map(table), async () => {
    if (mode === 'replace') {
      const missing = await missingIds(snapshot)
      if (missing.games.length) {
        for (const t of PLAY_TABLES) {
          await table(t).where('gameId').anyOf(missing.games).delete()
        }
      }
      for (const t of SNAPSHOT_TABLES) {
        if (missing[t].length) await table(t).bulkDelete(missing[t])
      }
    }
    for (const t of SNAPSHOT_TABLES) {
      if (snapshot[t].length) await table(t).bulkPut(snapshot[t])
    }
  })
  if (snapshot.settings) setSettings(snapshot.settings)
}

/**
 * Restore a previously exported snapshot into the local database.
 *
 * @remarks
 * The whole file is validated before anything is written, then written by
 * {@link applySnapshot}, so an invalid file or a failed write leaves the database
 * untouched. Accepts both v1 (with categories) and v2 snapshots.
 *
 * @param file - A `.json` file previously produced by {@link exportDatabase}.
 * @param mode - `merge` (default) keeps rows missing from the file; `replace` deletes them.
 * @throws If the file is too large, not valid JSON, has an unsupported snapshot
 *   version, or contains malformed records.
 */
export async function importDatabase(file: File, mode: ImportMode = 'merge'): Promise<void> {
  await applySnapshot(await readSnapshot(file), mode)
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
