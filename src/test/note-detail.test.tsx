// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { act } from 'react'
import { db } from '@/db'
import type { Note } from '@/db'
import NoteDetail from '@/pages/admin/NoteDetail'

function makeNote(overrides: Partial<Note> = {}): Note {
  const ts = Date.now()
  return {
    id: crypto.randomUUID(),
    name: 'Test Note',
    content: '# Hello\n\nWorld',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/notes/${id}`]}>
      <Routes>
        <Route path="/admin/notes/:id" element={<NoteDetail />} />
        <Route path="/admin/notes" element={<div>Notes list</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(async () => {
  await db.notes.clear()
})

describe('NoteDetail', () => {
  it('renders the note title and content when found', async () => {
    const note = makeNote({ name: 'My Round Intro', content: '## Welcome\n\nGood luck!' })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => expect(screen.getByText('My Round Intro')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })

  it('shows 404 and back link when note id does not exist', async () => {
    renderAt('nonexistent-id')

    await waitFor(() => expect(screen.getByText('404')).toBeInTheDocument())
    expect(screen.getByText('Note not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to notes' })).toBeInTheDocument()
  })

  it('shows empty state message when note content is blank', async () => {
    const note = makeNote({ name: 'Empty Note', content: '   ' })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => expect(screen.getByText('Empty Note')).toBeInTheDocument())
    expect(screen.getByText('This note is empty.')).toBeInTheDocument()
  })

  it('renders a back link pointing to /admin/notes', async () => {
    const note = makeNote()
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => screen.getByText(note.name))
    const link = screen.getByRole('link', { name: '← Notes' })
    expect(link).toHaveAttribute('href', '/admin/notes')
  })
})
