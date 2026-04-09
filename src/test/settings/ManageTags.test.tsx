// @vitest-pool vmForks
// Extends coverage for ManageTags beyond src/test/settings.test.tsx.
// Targets the uncovered lines:
//   33-34  empty-name guard → setError('Name is required')
//   46     catch block      → setError('Failed to save — name may already be in use')
//   107    Escape key in edit row closes editor
//   126    colour picker change on existing tag row
//   152    editing?.id === tag.id check inside remove()
//   162-163 useEffect clears error when editing changes
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/db'
import ManageTags from '@/components/settings/ManageTags'

async function clearAll() {
  await Promise.all([db.tags.clear(), db.questions.clear()])
}

describe('ManageTags — validation', () => {
  beforeEach(clearAll)

  it('shows error when name is empty on save', async () => {
    render(<ManageTags />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    // leave name blank
    fireEvent.click(await screen.findByRole('button', { name: /save/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('clears error when editing state changes', async () => {
    render(<ManageTags />)
    // Trigger error
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.click(await screen.findByRole('button', { name: /save/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    // Cancel clears editing → useEffect fires → error disappears
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument()
    })
  })
})

describe('ManageTags — db error on save', () => {
  beforeEach(clearAll)

  it('shows failure message when db.tags.add throws', async () => {
    vi.spyOn(db.tags, 'add').mockRejectedValueOnce(new Error('Unique constraint'))
    render(<ManageTags />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const input = await screen.findByPlaceholderText(/tag name/i)
    fireEvent.change(input, { target: { value: 'Duplicate' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument()
  })

  it('shows failure message when db.tags.update throws', async () => {
    await db.tags.add({ id: 't1', name: 'Existing', color: '#abc123' })
    vi.spyOn(db.tags, 'update').mockRejectedValueOnce(new Error('Unique constraint'))
    render(<ManageTags />)
    fireEvent.click(await screen.findByRole('button', { name: /edit existing/i }))
    const input = screen.getByDisplayValue('Existing')
    fireEvent.change(input, { target: { value: 'Duplicate' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument()
  })
})

describe('ManageTags — keyboard shortcuts in add row', () => {
  beforeEach(clearAll)

  it('closes add row on Escape', async () => {
    render(<ManageTags />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const input = await screen.findByPlaceholderText(/tag name/i)
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/tag name/i)).not.toBeInTheDocument()
    })
  })
})

describe('ManageTags — keyboard shortcuts in edit row', () => {
  beforeEach(clearAll)

  it('saves on Enter in edit row', async () => {
    await db.tags.add({ id: 't1', name: 'Original', color: '#aabbcc' })
    render(<ManageTags />)
    fireEvent.click(await screen.findByRole('button', { name: /edit original/i }))
    const input = screen.getByDisplayValue('Original')
    fireEvent.change(input, { target: { value: 'Updated' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Updated')).toBeInTheDocument()
  })

  it('closes edit row on Escape without saving', async () => {
    await db.tags.add({ id: 't1', name: 'Stable', color: '#aabbcc' })
    render(<ManageTags />)
    fireEvent.click(await screen.findByRole('button', { name: /edit stable/i }))
    const input = screen.getByDisplayValue('Stable')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(await screen.findByText('Stable')).toBeInTheDocument()
    expect(screen.queryByText('Changed')).not.toBeInTheDocument()
  })
})

describe('ManageTags — colour picker', () => {
  beforeEach(clearAll)

  it('updates colour in the add form', async () => {
    render(<ManageTags />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const colourInput = await screen.findByLabelText(/tag colour/i)
    fireEvent.change(colourInput, { target: { value: '#ff0000' } })
    // No save yet — just assert no error thrown and picker reflects change
    expect((colourInput as HTMLInputElement).value).toBe('#ff0000')
  })

  it('updates colour in the edit row', async () => {
    await db.tags.add({ id: 't1', name: 'Blue', color: '#0000ff' })
    render(<ManageTags />)
    fireEvent.click(await screen.findByRole('button', { name: /edit blue/i }))
    const colourInput = screen.getByLabelText(/tag colour/i)
    fireEvent.change(colourInput, { target: { value: '#ff0000' } })
    expect((colourInput as HTMLInputElement).value).toBe('#ff0000')
  })
})

describe('ManageTags — remove while another tag is being edited', () => {
  beforeEach(clearAll)

  it('can delete another tag while one is being edited', async () => {
    await db.tags.add({ id: 't1', name: 'Alpha', color: '#111111' })
    await db.tags.add({ id: 't2', name: 'Beta', color: '#222222' })
    render(<ManageTags />)

    // Open edit row for Alpha
    fireEvent.click(await screen.findByRole('button', { name: /edit alpha/i }))
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()

    // Beta's Delete button is still visible — click it
    fireEvent.click(screen.getByRole('button', { name: /delete beta/i }))

    await waitFor(async () => {
      expect(await db.tags.count()).toBe(1)
    })
    // Edit row for Alpha should still be open
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()
  })
})
