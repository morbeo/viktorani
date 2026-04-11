// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/db'
import ManageLabels from '@/components/players-teams/ManageLabels'

async function clearAll() {
  await Promise.all([db.managedLabels.clear(), db.managedPlayers.clear(), db.managedTeams.clear()])
}

// ── create ────────────────────────────────────────────────────────────────────

describe('ManageLabels — create', () => {
  beforeEach(clearAll)

  it('adds a new label and shows it in the list', async () => {
    render(<ManageLabels />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const input = await screen.findByPlaceholderText(/label name/i)
    fireEvent.change(input, { target: { value: 'Trivia' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText('Trivia')).toBeInTheDocument()
  })

  it('shows error when name is empty on save', async () => {
    render(<ManageLabels />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.click(await screen.findByRole('button', { name: /save/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('saves on Enter keypress', async () => {
    render(<ManageLabels />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const input = await screen.findByPlaceholderText(/label name/i)
    fireEvent.change(input, { target: { value: 'Sports' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Sports')).toBeInTheDocument()
  })

  it('closes add row on Escape without saving', async () => {
    render(<ManageLabels />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const input = await screen.findByPlaceholderText(/label name/i)
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/label name/i)).not.toBeInTheDocument()
    })
    expect(await db.managedLabels.count()).toBe(0)
  })

  it('clears error when editing state changes', async () => {
    render(<ManageLabels />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.click(await screen.findByRole('button', { name: /save/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument()
    })
  })

  it('shows failure message when db.managedLabels.add throws', async () => {
    vi.spyOn(db.managedLabels, 'add').mockRejectedValueOnce(new Error('constraint'))
    render(<ManageLabels />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const input = await screen.findByPlaceholderText(/label name/i)
    fireEvent.change(input, { target: { value: 'Dupe' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument()
  })
})

// ── edit ──────────────────────────────────────────────────────────────────────

describe('ManageLabels — edit', () => {
  beforeEach(clearAll)

  it('updates label name inline', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Original', color: '#aabbcc' })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /edit original/i }))
    const input = screen.getByDisplayValue('Original')
    fireEvent.change(input, { target: { value: 'Updated' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText('Updated')).toBeInTheDocument()
  })

  it('saves on Enter in edit row', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Alpha', color: '#111111' })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /edit alpha/i }))
    const input = screen.getByDisplayValue('Alpha')
    fireEvent.change(input, { target: { value: 'AlphaX' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('AlphaX')).toBeInTheDocument()
  })

  it('closes edit row on Escape without saving', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Stable', color: '#aabbcc' })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /edit stable/i }))
    const input = screen.getByDisplayValue('Stable')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(await screen.findByText('Stable')).toBeInTheDocument()
    expect(screen.queryByText('Changed')).not.toBeInTheDocument()
  })

  it('shows failure message when db.managedLabels.update throws', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Existing', color: '#abc123' })
    vi.spyOn(db.managedLabels, 'update').mockRejectedValueOnce(new Error('constraint'))
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /edit existing/i }))
    const input = screen.getByDisplayValue('Existing')
    fireEvent.change(input, { target: { value: 'Dupe' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument()
  })

  it('updates colour in the edit row', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Blue', color: '#0000ff' })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /edit blue/i }))
    const colourInput = screen.getByLabelText(/label colour/i)
    fireEvent.change(colourInput, { target: { value: '#ff0000' } })
    expect((colourInput as HTMLInputElement).value).toBe('#ff0000')
  })
})

// ── delete ────────────────────────────────────────────────────────────────────

describe('ManageLabels — delete', () => {
  beforeEach(clearAll)

  it('deletes a label not in use', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Unused', color: '#cccccc' })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /delete unused/i }))
    await waitFor(async () => {
      expect(await db.managedLabels.count()).toBe(0)
    })
  })

  it('blocks deletion when label is used by a player', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'InUse', color: '#cccccc' })
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Player',
      teamIds: [],
      labelIds: ['l1'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /delete inuse/i }))
    expect(await screen.findByText(/1 player/i)).toBeInTheDocument()
    expect(await db.managedLabels.count()).toBe(1)
  })

  it('blocks deletion when label is used by a team', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'TeamLabel', color: '#cccccc' })
    await db.managedTeams.add({
      id: 't1',
      name: 'Team',
      color: '#000',
      icon: 'Zap',
      labelIds: ['l1'],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /delete teamlabel/i }))
    expect(await screen.findByText(/1 team/i)).toBeInTheDocument()
    expect(await db.managedLabels.count()).toBe(1)
  })

  it('mentions both players and teams in the error when both use the label', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Shared', color: '#cccccc' })
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Player',
      teamIds: [],
      labelIds: ['l1'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    await db.managedTeams.add({
      id: 't1',
      name: 'Team',
      color: '#000',
      icon: 'Zap',
      labelIds: ['l1'],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /delete shared/i }))
    expect(await screen.findByText(/1 player.*1 team/i)).toBeInTheDocument()
  })

  it('can delete another label while one is being edited', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Alpha', color: '#111111' })
    await db.managedLabels.add({ id: 'l2', name: 'Beta', color: '#222222' })
    render(<ManageLabels />)
    fireEvent.click(await screen.findByRole('button', { name: /edit alpha/i }))
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /delete beta/i }))
    await waitFor(async () => {
      expect(await db.managedLabels.count()).toBe(1)
    })
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()
  })
})

// ── colour picker ─────────────────────────────────────────────────────────────

describe('ManageLabels — colour picker', () => {
  beforeEach(clearAll)

  it('updates colour in the add form', async () => {
    render(<ManageLabels />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    const colourInput = await screen.findByLabelText(/label colour/i)
    fireEvent.change(colourInput, { target: { value: '#ff0000' } })
    expect((colourInput as HTMLInputElement).value).toBe('#ff0000')
  })
})

// ── empty state ───────────────────────────────────────────────────────────────

describe('ManageLabels — empty state', () => {
  beforeEach(clearAll)

  it('shows empty message when no labels exist', async () => {
    render(<ManageLabels />)
    expect(await screen.findByText(/no labels yet/i)).toBeInTheDocument()
  })
})
