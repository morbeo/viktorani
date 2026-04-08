// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Note } from '@/db'

async function clearNotes() {
  await db.notes.clear()
}

function makeNote(overrides: Partial<Note> = {}): Note {
  const ts = Date.now()
  return {
    id: crypto.randomUUID(),
    name: 'Test Note',
    content: '# Hello\nThis is a note.',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

describe('Notes CRUD', () => {
  beforeEach(clearNotes)

  it('creates a note and retrieves it by id', async () => {
    const note = makeNote({ name: 'My Note', content: '**bold**' })
    await db.notes.add(note)
    const fetched = await db.notes.get(note.id)
    expect(fetched?.name).toBe('My Note')
    expect(fetched?.content).toBe('**bold**')
  })

  it('updates a note name and bumps updatedAt', async () => {
    const note = makeNote({ updatedAt: 1000 })
    await db.notes.add(note)
    const newTs = Date.now()
    await db.notes.update(note.id, { name: 'Renamed', updatedAt: newTs })
    const fetched = await db.notes.get(note.id)
    expect(fetched?.name).toBe('Renamed')
    expect(fetched?.updatedAt).toBe(newTs)
  })

  it('updates note content', async () => {
    const note = makeNote({ content: 'original' })
    await db.notes.add(note)
    await db.notes.update(note.id, { content: 'updated content', updatedAt: Date.now() })
    const fetched = await db.notes.get(note.id)
    expect(fetched?.content).toBe('updated content')
  })

  it('deletes a note', async () => {
    const note = makeNote()
    await db.notes.add(note)
    await db.notes.delete(note.id)
    expect(await db.notes.get(note.id)).toBeUndefined()
  })

  it('preserves createdAt when updating', async () => {
    const ts = 12345678
    const note = makeNote({ createdAt: ts })
    await db.notes.add(note)
    await db.notes.update(note.id, { name: 'New name', updatedAt: Date.now() })
    const fetched = await db.notes.get(note.id)
    expect(fetched?.createdAt).toBe(ts)
  })
})

// ── Ordering ──────────────────────────────────────────────────────────────────

describe('Notes ordering', () => {
  beforeEach(clearNotes)

  it('orders notes by updatedAt descending', async () => {
    await db.notes.bulkAdd([
      makeNote({ id: 'n1', name: 'Oldest', updatedAt: 1000 }),
      makeNote({ id: 'n2', name: 'Newest', updatedAt: 3000 }),
      makeNote({ id: 'n3', name: 'Middle', updatedAt: 2000 }),
    ])
    const all = await db.notes.orderBy('updatedAt').reverse().toArray()
    expect(all.map(n => n.name)).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('returns empty array when no notes exist', async () => {
    const all = await db.notes.toArray()
    expect(all).toHaveLength(0)
  })
})

// ── Search (filter logic) ─────────────────────────────────────────────────────

describe('Notes search filtering', () => {
  const notes: Note[] = [
    { id: 'n1', name: 'Geography Quiz', content: 'capitals of Europe', createdAt: 1, updatedAt: 1 },
    {
      id: 'n2',
      name: 'Science facts',
      content: 'photosynthesis and cells',
      createdAt: 2,
      updatedAt: 2,
    },
    {
      id: 'n3',
      name: 'Music trivia',
      content: 'guitar chords and scales',
      createdAt: 3,
      updatedAt: 3,
    },
  ]

  function filterNotes(all: Note[], search: string) {
    const q = search.toLowerCase()
    return all.filter(n => n.name.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
  }

  it('matches by note name', () => {
    expect(filterNotes(notes, 'Geography').map(n => n.id)).toEqual(['n1'])
  })

  it('matches by content', () => {
    expect(filterNotes(notes, 'photosynthesis').map(n => n.id)).toEqual(['n2'])
  })

  it('is case-insensitive', () => {
    expect(filterNotes(notes, 'MUSIC')).toHaveLength(1)
  })

  it('returns all notes when search is empty', () => {
    expect(filterNotes(notes, '')).toHaveLength(3)
  })

  it('returns empty when no match', () => {
    expect(filterNotes(notes, 'zzznomatch')).toHaveLength(0)
  })

  it('matches partial strings', () => {
    expect(filterNotes(notes, 'chord')).toHaveLength(1)
  })
})

// ── Content ───────────────────────────────────────────────────────────────────

describe('Notes content', () => {
  beforeEach(clearNotes)

  it('stores empty content', async () => {
    const note = makeNote({ content: '' })
    await db.notes.add(note)
    expect((await db.notes.get(note.id))?.content).toBe('')
  })

  it('stores multiline markdown', async () => {
    const md = '# Title\n\n- item 1\n- item 2\n\n**bold** and _italic_'
    const note = makeNote({ content: md })
    await db.notes.add(note)
    expect((await db.notes.get(note.id))?.content).toBe(md)
  })

  it('stores long content without truncation', async () => {
    const long = 'word '.repeat(500)
    const note = makeNote({ content: long })
    await db.notes.add(note)
    expect((await db.notes.get(note.id))?.content).toBe(long)
  })
})
