// @vitest-pool vmForks
// Replace import (#518): rows missing from the file are removed, with removed games' play data.
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Game, Player, Question, Round, Tag } from '@/db'
import { applySnapshot, importDatabase, previewReplace } from '@/db/snapshot'
import type { ParsedSnapshot } from '@/db/snapshot'

const tag = (id: string, name: string): Tag => ({ id, name, color: '#c9a84c' })

const question = (id: string, title: string): Question =>
  ({
    id,
    title,
    type: 'open_ended',
    options: [],
    answer: 'a',
    description: '',
    media: null,
    mediaType: null,
    difficulty: null,
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  }) as Question

const round: Round = { id: 'r1', name: 'One', description: '', questionIds: ['q1'], createdAt: 0 }

const game = (id: string, name: string) => ({ id, name, roundIds: ['r1'] }) as Game

function snapshot(parts: Partial<ParsedSnapshot>): ParsedSnapshot {
  return {
    difficulties: [],
    tags: [],
    questions: [],
    rounds: [],
    games: [],
    gameQuestions: [],
    notes: [],
    layouts: [],
    widgets: [],
    themes: [],
    ...parts,
  }
}

function jsonFile(value: unknown) {
  return new File([JSON.stringify(value)], 'backup.json', { type: 'application/json' })
}

beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()))
  await db.tags.bulkAdd([tag('t1', 'Music'), tag('t2', 'Film')])
  await db.questions.bulkAdd([question('q1', 'Kept'), question('q2', 'Dropped')])
  await db.rounds.add(round)
  await db.games.bulkAdd([game('g1', 'Friday'), game('g2', 'Old night')])
  await db.players.bulkAdd([
    { id: 'p1', gameId: 'g1', name: 'Ana' } as Player,
    { id: 'p2', gameId: 'g2', name: 'Bo' } as Player,
  ])
})

describe('previewReplace', () => {
  it('lists what the file lacks, by name, without writing', async () => {
    const groups = await previewReplace(
      snapshot({
        tags: [tag('t1', 'Music')],
        questions: [question('q1', 'Kept')],
        rounds: [round],
        games: [game('g1', 'Friday')],
      })
    )
    expect(groups).toEqual([
      { table: 'tags', count: 1, names: ['Film'] },
      { table: 'questions', count: 1, names: ['Dropped'] },
      { table: 'games', count: 1, names: ['Old night'] },
    ])
    expect(await db.questions.count()).toBe(2)
  })

  it('is empty when the file has everything', async () => {
    const all = snapshot({
      tags: await db.tags.toArray(),
      questions: await db.questions.toArray(),
      rounds: await db.rounds.toArray(),
      games: await db.games.toArray(),
    })
    expect(await previewReplace(all)).toEqual([])
  })
})

describe('applySnapshot', () => {
  it('keeps rows missing from the file in merge mode', async () => {
    await applySnapshot(snapshot({ tags: [tag('t3', 'Sport')] }))
    expect((await db.tags.toArray()).map(t => t.id).sort()).toEqual(['t1', 't2', 't3'])
    expect(await db.games.count()).toBe(2)
  })

  it('removes rows missing from the file and the play data of removed games', async () => {
    await applySnapshot(
      snapshot({
        tags: [tag('t1', 'Music (renamed)')],
        questions: [question('q1', 'Kept')],
        rounds: [round],
        games: [game('g1', 'Friday')],
      }),
      'replace'
    )
    expect(await db.tags.toArray()).toEqual([tag('t1', 'Music (renamed)')])
    expect((await db.questions.toArray()).map(q => q.id)).toEqual(['q1'])
    expect((await db.games.toArray()).map(g => g.id)).toEqual(['g1'])
    expect((await db.players.toArray()).map(p => p.id)).toEqual(['p1'])
  })

  it('empties every snapshot collection for an empty file', async () => {
    await applySnapshot(snapshot({}), 'replace')
    expect(await db.tags.count()).toBe(0)
    expect(await db.rounds.count()).toBe(0)
    expect(await db.players.count()).toBe(0)
  })
})

describe('importDatabase in replace mode', () => {
  it('replaces from a file', async () => {
    await importDatabase(
      jsonFile({ version: 2, exportedAt: 1, tags: [tag('t2', 'Film')] }),
      'replace'
    )
    expect((await db.tags.toArray()).map(t => t.id)).toEqual(['t2'])
    expect(await db.questions.count()).toBe(0)
  })

  it('writes nothing for an invalid file', async () => {
    await expect(importDatabase(jsonFile({ version: 2, tags: [{}] }), 'replace')).rejects.toThrow(
      /Invalid backup file/
    )
    expect(await db.tags.count()).toBe(2)
    expect(await db.questions.count()).toBe(2)
  })
})
