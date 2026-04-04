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
