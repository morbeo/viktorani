// @vitest-pool vmForks
// Extends coverage for ManageDifficulties beyond src/test/settings.test.tsx.
// Targets uncovered lines:
//   42-43  empty-name validation → setError('Name is required')
//   51-52  negative-score validation → setError('Score must be a non-negative number')
//   55-56  catch block → setError('Failed to save')
//   75     cancel() in edit row
//   99-118 onDragStart / onDragOver / onDrop (drag-to-reorder)
//   163    editing?.id === d.id check inside remove()
//   174-175 colour picker changes
//   208-231 edit-row Escape / Enter keyboard shortcuts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/db'
import ManageDifficulties from '@/components/settings/ManageDifficulties'

async function clearAll() {
  await Promise.all([db.difficulties.clear(), db.questions.clear()])
}

const SEED = [
  { id: 'd1', name: 'Easy', score: 5, color: '#27ae60', order: 0 },
  { id: 'd2', name: 'Medium', score: 10, color: '#e67e22', order: 1 },
  { id: 'd3', name: 'Hard', score: 15, color: '#c0392b', order: 2 },
]

// ── Validation ─────────────────────────────────────────────────────────────────

describe('ManageDifficulties — validation', () => {
  beforeEach(clearAll)

  it('shows error when name is empty on save', async () => {
    render(<ManageDifficulties />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    // Leave name blank, fill score
    const scoreInput = await screen.findByPlaceholderText('pts')
    fireEvent.change(scoreInput, { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('shows error when score is negative', async () => {
    render(<ManageDifficulties />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const nameInput = await screen.findByPlaceholderText('Name')
    fireEvent.change(nameInput, { target: { value: 'Negative' } })
    const scoreInput = screen.getByPlaceholderText('pts')
    fireEvent.change(scoreInput, { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/non-negative/i)).toBeInTheDocument()
  })
})

// ── DB error on save ───────────────────────────────────────────────────────────

describe('ManageDifficulties — db error on save', () => {
  beforeEach(clearAll)

  it('shows failure message when db.difficulties.add throws', async () => {
    vi.spyOn(db.difficulties, 'add').mockRejectedValueOnce(new Error('Constraint'))
    render(<ManageDifficulties />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const nameInput = await screen.findByPlaceholderText('Name')
    fireEvent.change(nameInput, { target: { value: 'Boom' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument()
  })
})

// ── Cancel ─────────────────────────────────────────────────────────────────────

describe('ManageDifficulties — cancel', () => {
  beforeEach(clearAll)

  it('cancel() on add row hides form and clears error', async () => {
    render(<ManageDifficulties />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    await screen.findByPlaceholderText('Name')
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
    })
  })

  it('cancel() on edit row discards changes', async () => {
    await db.difficulties.bulkAdd(SEED)
    render(<ManageDifficulties />)
    fireEvent.click(await screen.findByRole('button', { name: /edit easy/i }))
    const nameInput = screen.getByDisplayValue('Easy')
    fireEvent.change(nameInput, { target: { value: 'Changed' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(await screen.findByText('Easy')).toBeInTheDocument()
    expect(screen.queryByText('Changed')).not.toBeInTheDocument()
  })
})

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────

describe('ManageDifficulties — keyboard shortcuts', () => {
  beforeEach(clearAll)

  it('saves on Enter in add row', async () => {
    render(<ManageDifficulties />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const nameInput = await screen.findByPlaceholderText('Name')
    fireEvent.change(nameInput, { target: { value: 'FromEnter' } })
    fireEvent.keyDown(nameInput, { key: 'Enter' })
    expect(await screen.findByText('FromEnter')).toBeInTheDocument()
  })

  it('cancels on Escape in add row', async () => {
    render(<ManageDifficulties />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const nameInput = await screen.findByPlaceholderText('Name')
    fireEvent.keyDown(nameInput, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
    })
  })

  it('saves on Enter in edit row', async () => {
    await db.difficulties.bulkAdd(SEED)
    render(<ManageDifficulties />)
    fireEvent.click(await screen.findByRole('button', { name: /edit easy/i }))
    const nameInput = screen.getByDisplayValue('Easy')
    fireEvent.change(nameInput, { target: { value: 'Easiest' } })
    fireEvent.keyDown(nameInput, { key: 'Enter' })
    expect(await screen.findByText('Easiest')).toBeInTheDocument()
  })

  it('cancels on Escape in edit row', async () => {
    await db.difficulties.bulkAdd(SEED)
    render(<ManageDifficulties />)
    fireEvent.click(await screen.findByRole('button', { name: /edit medium/i }))
    const nameInput = screen.getByDisplayValue('Medium')
    fireEvent.keyDown(nameInput, { key: 'Escape' })
    expect(await screen.findByText('Medium')).toBeInTheDocument()
  })
})

// ── Colour picker ──────────────────────────────────────────────────────────────

describe('ManageDifficulties — colour picker', () => {
  beforeEach(clearAll)

  it('updates colour in the add form', async () => {
    render(<ManageDifficulties />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const picker = await screen.findByLabelText(/difficulty colour/i)
    fireEvent.change(picker, { target: { value: '#ff0000' } })
    expect((picker as HTMLInputElement).value).toBe('#ff0000')
  })

  it('updates colour in the edit row', async () => {
    await db.difficulties.bulkAdd(SEED)
    render(<ManageDifficulties />)
    fireEvent.click(await screen.findByRole('button', { name: /edit hard/i }))
    const picker = screen.getByLabelText(/difficulty colour/i)
    fireEvent.change(picker, { target: { value: '#123456' } })
    expect((picker as HTMLInputElement).value).toBe('#123456')
  })
})

// ── Remove while another item is being edited ──────────────────────────────────

describe('ManageDifficulties — remove while another item is being edited', () => {
  beforeEach(clearAll)

  it('can delete another difficulty while one is being edited', async () => {
    await db.difficulties.bulkAdd(SEED)
    render(<ManageDifficulties />)

    // Open edit row for Easy
    fireEvent.click(await screen.findByRole('button', { name: /edit easy/i }))
    expect(screen.getByDisplayValue('Easy')).toBeInTheDocument()

    // Medium and Hard rows are still visible with their Delete buttons
    fireEvent.click(screen.getByRole('button', { name: /delete medium/i }))

    await waitFor(async () => {
      const all = await db.difficulties.toArray()
      expect(all.map(d => d.name)).not.toContain('Medium')
    })
    // Edit row for Easy should still be open
    expect(screen.getByDisplayValue('Easy')).toBeInTheDocument()
  })
})

// ── Drag-to-reorder ────────────────────────────────────────────────────────────

describe('ManageDifficulties — drag-to-reorder', () => {
  beforeEach(clearAll)

  it('reorders items when dragged to a new position', async () => {
    await db.difficulties.bulkAdd(SEED)
    render(<ManageDifficulties />)

    // Wait for all three rows to appear
    await screen.findByText('Easy')
    const rows = document.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(3)

    const [easyRow, , hardRow] = Array.from(rows)

    // Drag Easy (idx 0) → drop on Hard (idx 2)
    fireEvent.dragStart(easyRow, { dataTransfer: { effectAllowed: '' } })
    fireEvent.dragOver(hardRow, { dataTransfer: { dropEffect: '' } })
    fireEvent.drop(hardRow, {})

    await waitFor(async () => {
      const all = await db.difficulties.orderBy('order').toArray()
      // Medium(0), Hard(1), Easy(2)
      expect(all[2].name).toBe('Easy')
    })
  })

  it('is a no-op when dropped on the same index', async () => {
    await db.difficulties.bulkAdd(SEED)
    const bulkPutSpy = vi.spyOn(db.difficulties, 'bulkPut')

    render(<ManageDifficulties />)
    await screen.findByText('Easy')

    const [easyRow] = Array.from(document.querySelectorAll('[draggable="true"]'))

    // Drag Easy → drop on Easy (same index)
    fireEvent.dragStart(easyRow, { dataTransfer: { effectAllowed: '' } })
    fireEvent.dragOver(easyRow, { dataTransfer: { dropEffect: '' } })
    fireEvent.drop(easyRow, {})

    await new Promise(r => setTimeout(r, 50))
    expect(bulkPutSpy).not.toHaveBeenCalled()
    bulkPutSpy.mockRestore()
  })
})
