import { db } from '@/db'

export interface DatabaseSnapshot {
  version:     number
  exportedAt:  number
  categories:  unknown[]
  difficulties:unknown[]
  tags:        unknown[]
  questions:   unknown[]
  rounds:      unknown[]
  games:       unknown[]
  notes:       unknown[]
}

export async function exportDatabase(): Promise<void> {
  const snapshot: DatabaseSnapshot = {
    version:      1,
    exportedAt:   Date.now(),
    categories:   await db.categories.toArray(),
    difficulties: await db.difficulties.toArray(),
    tags:         await db.tags.toArray(),
    questions:    await db.questions.toArray(),
    rounds:       await db.rounds.toArray(),
    games:        await db.games.toArray(),
    notes:        await db.notes.toArray(),
  }

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `viktorani-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importDatabase(file: File): Promise<void> {
  const text     = await file.text()
  const snapshot = JSON.parse(text) as DatabaseSnapshot

  if (snapshot.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${snapshot.version}`)
  }

  // Merge — existing records with same ID are overwritten
  await db.transaction('rw',
    [db.categories, db.difficulties, db.tags, db.questions, db.rounds, db.games, db.notes],
    async () => {
      if (snapshot.categories?.length)   await db.categories.bulkPut(snapshot.categories as any)
      if (snapshot.difficulties?.length) await db.difficulties.bulkPut(snapshot.difficulties as any)
      if (snapshot.tags?.length)         await db.tags.bulkPut(snapshot.tags as any)
      if (snapshot.questions?.length)    await db.questions.bulkPut(snapshot.questions as any)
      if (snapshot.rounds?.length)       await db.rounds.bulkPut(snapshot.rounds as any)
      if (snapshot.games?.length)        await db.games.bulkPut(snapshot.games as any)
      if (snapshot.notes?.length)        await db.notes.bulkPut(snapshot.notes as any)
    }
  )
}
