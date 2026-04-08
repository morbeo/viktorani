import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/db'
import ManageCategories from '@/components/settings/ManageCategories'
import ManageDifficulties from '@/components/settings/ManageDifficulties'

// ── helpers ───────────────────────────────────────────────────────────────────

async function clearAll() {
  await Promise.all([db.categories.clear(), db.difficulties.clear(), db.questions.clear()])
}

// ── ManageCategories ──────────────────────────────────────────────────────────

describe('ManageCategories', () => {
  beforeEach(clearAll)

  it('renders empty state', async () => {
    render(<ManageCategories />)
    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument()
  })

  it('adds a new category', async () => {
    render(<ManageCategories />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const input = await screen.findByPlaceholderText(/category name/i)
    fireEvent.change(input, { target: { value: 'Science' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Science')).toBeInTheDocument()
    const count = await db.categories.count()
    expect(count).toBe(1)
  })

  it('edits an existing category', async () => {
    await db.categories.add({ id: 'c1', name: 'History', color: '#e67e22' })
    render(<ManageCategories />)

    fireEvent.click(await screen.findByRole('button', { name: /edit history/i }))

    const input = screen.getByDisplayValue('History')
    fireEvent.change(input, { target: { value: 'Ancient History' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Ancient History')).toBeInTheDocument()
    const cat = await db.categories.get('c1')
    expect(cat?.name).toBe('Ancient History')
  })

  it('deletes a category', async () => {
    await db.categories.add({ id: 'c1', name: 'Sports', color: '#27ae60' })
    render(<ManageCategories />)

    fireEvent.click(await screen.findByRole('button', { name: /delete sports/i }))

    await waitFor(async () => {
      expect(await db.categories.count()).toBe(0)
    })
    expect(screen.queryByText('Sports')).not.toBeInTheDocument()
  })

  it('blocks deletion of a category in use', async () => {
    const catId = 'c1'
    await db.categories.add({ id: catId, name: 'Music', color: '#8e44ad' })
    await db.questions.add({
      id: 'q1',
      categoryId: catId,
      difficulty: 'd1',
      type: 'text',
      question: 'Q?',
      answer: 'A',
      createdAt: Date.now(),
    } as unknown as Parameters<typeof db.questions.add>[0])

    render(<ManageCategories />)

    fireEvent.click(await screen.findByRole('button', { name: /delete music/i }))

    expect(await screen.findByText(/1 question/i)).toBeInTheDocument()
    expect(await db.categories.count()).toBe(1)
  })

  it('cancels inline edit without saving', async () => {
    await db.categories.add({ id: 'c1', name: 'Geography', color: '#16a085' })
    render(<ManageCategories />)

    fireEvent.click(await screen.findByRole('button', { name: /edit geography/i }))
    const input = screen.getByDisplayValue('Geography')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(await screen.findByText('Geography')).toBeInTheDocument()
    expect(screen.queryByText('Changed')).not.toBeInTheDocument()
  })

  it('saves on Enter key', async () => {
    render(<ManageCategories />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    const input = await screen.findByPlaceholderText(/category name/i)
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
      categoryId: 'c1',
      difficulty: 'd1',
      type: 'text',
      question: 'Q?',
      answer: 'A',
      createdAt: Date.now(),
    } as unknown as Parameters<typeof db.questions.add>[0])

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
      await screen.findByText(name)
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
