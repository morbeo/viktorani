// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/db'
import ManageTags from '@/components/settings/ManageTags'
import ManageDifficulties from '@/components/settings/ManageDifficulties'

async function clearAll() {
  await Promise.all([db.tags.clear(), db.difficulties.clear(), db.questions.clear()])
}

// ── ManageTags ────────────────────────────────────────────────────────────────

describe('ManageTags', () => {
  beforeEach(clearAll)

  it('renders empty state', async () => {
    render(<ManageTags />)
    expect(await screen.findByText(/no tags yet/i)).toBeInTheDocument()
  })

  it('adds a new tag', async () => {
    render(<ManageTags />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const input = await screen.findByPlaceholderText(/tag name/i)
    fireEvent.change(input, { target: { value: 'Science' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Science')).toBeInTheDocument()
    expect(await db.tags.count()).toBe(1)
  })

  it('edits an existing tag', async () => {
    await db.tags.add({ id: 't1', name: 'History', color: '#e67e22' })
    render(<ManageTags />)

    fireEvent.click(await screen.findByRole('button', { name: /edit history/i }))

    const input = screen.getByDisplayValue('History')
    fireEvent.change(input, { target: { value: 'Ancient History' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Ancient History')).toBeInTheDocument()
    const tag = await db.tags.get('t1')
    expect(tag?.name).toBe('Ancient History')
  })

  it('deletes a tag', async () => {
    await db.tags.add({ id: 't1', name: 'Sports', color: '#27ae60' })
    render(<ManageTags />)

    fireEvent.click(await screen.findByRole('button', { name: /delete sports/i }))

    await waitFor(async () => {
      expect(await db.tags.count()).toBe(0)
    })
    expect(screen.queryByText('Sports')).not.toBeInTheDocument()
  })

  it('blocks deletion of a tag in use', async () => {
    await db.tags.add({ id: 't1', name: 'Music', color: '#8e44ad' })
    await db.questions.add({
      id: 'q1',
      title: 'Q?',
      type: 'open_ended',
      options: [],
      answer: 'A',
      description: '',
      difficulty: null,
      tags: ['t1'],
      media: null,
      mediaType: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    render(<ManageTags />)
    fireEvent.click(await screen.findByRole('button', { name: /delete music/i }))

    expect(await screen.findByText(/1 question/i)).toBeInTheDocument()
    expect(await db.tags.count()).toBe(1)
  })

  it('cancels inline edit without saving', async () => {
    await db.tags.add({ id: 't1', name: 'Geography', color: '#16a085' })
    render(<ManageTags />)

    fireEvent.click(await screen.findByRole('button', { name: /edit geography/i }))
    const input = screen.getByDisplayValue('Geography')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(await screen.findByText('Geography')).toBeInTheDocument()
    expect(screen.queryByText('Changed')).not.toBeInTheDocument()
  })

  it('saves on Enter key', async () => {
    render(<ManageTags />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const input = await screen.findByPlaceholderText(/tag name/i)
    fireEvent.change(input, { target: { value: 'Movies' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText('Movies')).toBeInTheDocument()
  })
})

// ── ManageDifficulties ────────────────────────────────────────────────────────

describe('ManageDifficulties', () => {
  beforeEach(clearAll)

  it('renders empty state', async () => {
    render(<ManageDifficulties />)
    expect(await screen.findByText(/no difficulty levels/i)).toBeInTheDocument()
  })

  it('adds a new difficulty', async () => {
    render(<ManageDifficulties />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const nameInput = await screen.findByPlaceholderText('Name')
    const scoreInput = screen.getByPlaceholderText('pts')

    fireEvent.change(nameInput, { target: { value: 'Easy' } })
    fireEvent.change(scoreInput, { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Easy')).toBeInTheDocument()
    expect(await screen.findByText('5 pts')).toBeInTheDocument()
    expect(await db.difficulties.count()).toBe(1)
  })

  it('edits score of existing difficulty', async () => {
    await db.difficulties.add({ id: 'd1', name: 'Medium', score: 10, color: '#e67e22', order: 0 })
    render(<ManageDifficulties />)

    fireEvent.click(await screen.findByRole('button', { name: /edit medium/i }))

    const scoreInput = screen.getByDisplayValue('10')
    fireEvent.change(scoreInput, { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('20 pts')).toBeInTheDocument()
    const d = await db.difficulties.get('d1')
    expect(d?.score).toBe(20)
  })

  it('blocks deletion of a difficulty in use', async () => {
    await db.difficulties.add({ id: 'd1', name: 'Hard', score: 15, color: '#c0392b', order: 0 })
    await db.questions.add({
      id: 'q1',
      title: 'Q?',
      type: 'open_ended',
      options: [],
      answer: 'A',
      description: '',
      difficulty: 'd1',
      tags: [],
      media: null,
      mediaType: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    render(<ManageDifficulties />)
    fireEvent.click(await screen.findByRole('button', { name: /delete hard/i }))

    expect(await screen.findByText(/1 question/i)).toBeInTheDocument()
    expect(await db.difficulties.count()).toBe(1)
  })

  it('assigns correct order to newly added difficulties', async () => {
    render(<ManageDifficulties />)

    for (const name of ['Easy', 'Medium', 'Hard']) {
      fireEvent.click(screen.getByRole('button', { name: /add/i }))
      const nameInput = await screen.findByPlaceholderText('Name')
      fireEvent.change(nameInput, { target: { value: name } })
      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => screen.getByText(name))
    }

    const all = await db.difficulties.orderBy('order').toArray()
    expect(all.map(d => d.name)).toEqual(['Easy', 'Medium', 'Hard'])
    expect(all.map(d => d.order)).toEqual([0, 1, 2])
  })

  it('re-normalises order after delete', async () => {
    await db.difficulties.bulkAdd([
      { id: 'd1', name: 'Easy', score: 5, color: '#27ae60', order: 0 },
      { id: 'd2', name: 'Medium', score: 10, color: '#e67e22', order: 1 },
      { id: 'd3', name: 'Hard', score: 15, color: '#c0392b', order: 2 },
    ])

    render(<ManageDifficulties />)
    fireEvent.click(await screen.findByRole('button', { name: /delete medium/i }))

    await waitFor(async () => {
      const all = await db.difficulties.orderBy('order').toArray()
      expect(all.map(d => d.order)).toEqual([0, 1])
    })
  })
})
