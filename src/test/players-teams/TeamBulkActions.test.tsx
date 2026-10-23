// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { db } from '@/db'
import type { ManagedTeam } from '@/db'
import { SETTINGS_KEY } from '@/lib/app-settings'
import TeamBulkActionBar from '@/components/players-teams/TeamBulkActionBar'

const team = (id: string, labelIds: string[] = []): ManagedTeam => ({
  id,
  name: `Team ${id}`,
  color: '#3a57b7',
  icon: 'Shield',
  labelIds,
  playerIds: [],
  archivedAt: null,
  totalScore: 0,
  gameLog: [],
})

beforeEach(async () => {
  localStorage.clear()
  await Promise.all([db.managedTeams.clear(), db.managedLabels.clear()])
  await db.managedLabels.bulkAdd([
    { id: 'l1', name: 'Trivia', color: '#6366f1' },
    { id: 'l2', name: 'Sports', color: '#e67e22' },
  ])
  await db.managedTeams.bulkAdd([team('t1', ['l1']), team('t2'), team('t3')])
})

function renderBar(ids: string[]) {
  const onDone = vi.fn()
  render(<TeamBulkActionBar selectedIds={new Set(ids)} onDone={onDone} />)
  return onDone
}

async function labelsOf(id: string) {
  return (await db.managedTeams.get(id))?.labelIds
}

describe('TeamBulkActionBar', () => {
  it('shows how many teams are selected', () => {
    renderBar(['t1', 't2'])
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('adds a label to every selected team once', async () => {
    const onDone = renderBar(['t1', 't2'])
    fireEvent.click(screen.getByRole('button', { name: 'Add label to selected teams' }))
    expect(screen.getByText('Add label to 2 teams:')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Trivia' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(await labelsOf('t1')).toEqual(['l1'])
    expect(await labelsOf('t2')).toEqual(['l1'])
    expect(await labelsOf('t3')).toEqual([])
  })

  it('removes a label from the selected teams that have it', async () => {
    const onDone = renderBar(['t1', 't2'])
    fireEvent.click(screen.getByRole('button', { name: 'Remove label from selected teams' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Trivia' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(await labelsOf('t1')).toEqual([])
    expect(await labelsOf('t2')).toEqual([])
  })

  it('skips selected teams that no longer exist', async () => {
    const onDone = renderBar(['t1', 'gone'])
    fireEvent.click(screen.getByRole('button', { name: 'Add label to selected teams' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sports' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(await labelsOf('t1')).toEqual(['l1', 'l2'])
    expect(await db.managedTeams.get('gone')).toBeUndefined()
  })

  it('says when there are no labels to add', async () => {
    await db.managedLabels.clear()
    renderBar(['t1'])
    fireEvent.click(screen.getByRole('button', { name: 'Add label to selected teams' }))
    expect(await screen.findByText('No labels yet')).toBeInTheDocument()
    expect(screen.getByText('Add label to 1 team:')).toBeInTheDocument()
  })

  it('archives the selected teams after confirming', async () => {
    const onDone = renderBar(['t1', 't2'])
    fireEvent.click(screen.getByRole('button', { name: 'Archive selected teams' }))
    expect(screen.getByText(/Archiving 2 teams/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect((await db.managedTeams.get('t1'))?.archivedAt).toBeInstanceOf(Date)
    expect((await db.managedTeams.get('t2'))?.archivedAt).toBeInstanceOf(Date)
    expect((await db.managedTeams.get('t3'))?.archivedAt).toBeNull()
  })

  it('keeps the teams when archiving is cancelled', async () => {
    const onDone = renderBar(['t1'])
    fireEvent.click(screen.getByRole('button', { name: 'Archive selected teams' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Archiving 1 team\./)).not.toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    expect((await db.managedTeams.get('t1'))?.archivedAt).toBeNull()
  })

  it('archives straight away when confirmDestructive is off', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 4, confirmDestructive: false }))
    const onDone = renderBar(['t3'])
    fireEvent.click(screen.getByRole('button', { name: 'Archive selected teams' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect((await db.managedTeams.get('t3'))?.archivedAt).toBeInstanceOf(Date)
  })

  it('clears the selection', () => {
    const onDone = renderBar(['t1'])
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
