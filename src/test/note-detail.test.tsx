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

  it('renders unordered list items as <li> elements', async () => {
    const note = makeNote({ content: '- Alpha\n- Beta\n- Gamma' })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument())
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
    expect(document.querySelector('ul')).toBeInTheDocument()
  })

  it('renders ordered list items as <ol><li> elements', async () => {
    const note = makeNote({ content: '1. First\n2. Second\n3. Third' })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument())
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(document.querySelector('ol')).toBeInTheDocument()
  })

  it('renders h5 as an <h5> element', async () => {
    const note = makeNote({ content: '##### Section Five' })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Section Five', level: 5 })).toBeInTheDocument()
    )
  })

  it('renders h6 as an <h6> element', async () => {
    const note = makeNote({ content: '###### Section Six' })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Section Six', level: 6 })).toBeInTheDocument()
    )
  })

  it('renders nested ordered list as ol > ol in the DOM', async () => {
    const note = makeNote({
      content: '1. First\n   1. Nested A\n   2. Nested B\n2. Second',
    })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument())
    expect(document.querySelector('ol ol')).toBeInTheDocument()
    expect(screen.getByText('Nested A')).toBeInTheDocument()
    expect(screen.getByText('Nested B')).toBeInTheDocument()
  })

  it('renders definition list terms and descriptions', async () => {
    const note = makeNote({
      content: 'Apple\n:   A fruit\n\nBanana\n:   Another fruit',
    })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => expect(screen.getByText('Apple')).toBeInTheDocument())
    expect(screen.getByText('A fruit')).toBeInTheDocument()
    expect(document.querySelector('dl')).toBeInTheDocument()
    expect(document.querySelector('dt')).toBeInTheDocument()
    expect(document.querySelector('dd')).toBeInTheDocument()
  })

  it('renders safe inline html', async () => {
    const note = makeNote({ content: 'Before <strong>bold</strong> after' })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => expect(screen.getByText('bold')).toBeInTheDocument())
    expect(document.querySelector('strong')).toBeInTheDocument()
  })

  it('strips dangerous html attributes (xss guard)', async () => {
    const note = makeNote({
      content: '<p onclick="alert(1)">Click me</p>',
    })
    await act(async () => {
      await db.notes.add(note)
    })

    renderAt(note.id)

    await waitFor(() => expect(screen.getByText('Click me')).toBeInTheDocument())
    const p = document.querySelector('p[onclick]')
    expect(p).not.toBeInTheDocument()
  })
})
