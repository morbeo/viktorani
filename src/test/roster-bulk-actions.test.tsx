import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RosterBulkActionBar } from '@/components/gamemaster/RosterBulkActionBar'
import { SETTINGS_KEY } from '@/lib/app-settings'
import type { Team } from '@/db'

const teams: Team[] = [
  { id: 't1', gameId: 'g1', name: 'Owls', color: '#000', icon: 'Shield', score: 0, notes: '' },
  { id: 't2', gameId: 'g1', name: 'Foxes', color: '#000', icon: 'nope', score: 0, notes: '' },
]

function renderBar(ids: string[]) {
  const props = {
    selectedIds: new Set(ids),
    teams,
    onAssignPlayer: vi.fn().mockResolvedValue(undefined),
    onAdjustScore: vi.fn().mockResolvedValue(undefined),
    onKick: vi.fn(),
    onDone: vi.fn(),
  }
  render(<RosterBulkActionBar {...props} />)
  return props
}

beforeEach(() => {
  localStorage.clear()
})

describe('RosterBulkActionBar', () => {
  it('assigns every selected player to the chosen team', async () => {
    const p = renderBar(['p1', 'p2'])
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Assign team to selected players' }))
    expect(screen.getByText('Move 2 players to a team:')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Foxes/ }))
    await waitFor(() => expect(p.onDone).toHaveBeenCalled())
    expect(p.onAssignPlayer.mock.calls).toEqual([
      ['p1', 't2'],
      ['p2', 't2'],
    ])
  })

  it('takes the selected players off their teams', async () => {
    const p = renderBar(['p1'])
    fireEvent.click(screen.getByRole('button', { name: 'Assign team to selected players' }))
    expect(screen.getByText('Move 1 player to a team:')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'No team' }))
    await waitFor(() => expect(p.onDone).toHaveBeenCalled())
    expect(p.onAssignPlayer).toHaveBeenCalledWith('p1', null)
  })

  it.each([
    ['+ 3', 3],
    ['− 3', -3],
  ])('adjusts every selected score with %s', async (button, delta) => {
    const p = renderBar(['p1', 'p2'])
    fireEvent.click(screen.getByRole('button', { name: 'Adjust score for selected players' }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: button }))
    await waitFor(() => expect(p.onDone).toHaveBeenCalled())
    expect(p.onAdjustScore.mock.calls).toEqual([
      ['p1', delta],
      ['p2', delta],
    ])
  })

  it('treats a cleared points field as zero', () => {
    renderBar(['p1'])
    fireEvent.click(screen.getByRole('button', { name: 'Adjust score for selected players' }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: '+ 0' })).toBeInTheDocument()
  })

  it('kicks the selected players after confirming', () => {
    const p = renderBar(['p1', 'p2'])
    fireEvent.click(screen.getByRole('button', { name: 'Kick selected players' }))
    expect(screen.getByText(/Kicking 2 players/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kick' }))
    expect(p.onKick.mock.calls).toEqual([['p1'], ['p2']])
    expect(p.onDone).toHaveBeenCalledTimes(1)
  })

  it('kicks nobody when the confirmation is cancelled', () => {
    const p = renderBar(['p1'])
    fireEvent.click(screen.getByRole('button', { name: 'Kick selected players' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(p.onKick).not.toHaveBeenCalled()
    expect(p.onDone).not.toHaveBeenCalled()
  })

  it('kicks straight away when confirmDestructive is off', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 4, confirmDestructive: false }))
    const p = renderBar(['p1'])
    fireEvent.click(screen.getByRole('button', { name: 'Kick selected players' }))
    expect(p.onKick).toHaveBeenCalledWith('p1')
    expect(p.onDone).toHaveBeenCalledTimes(1)
  })

  it('clears the selection', () => {
    const p = renderBar(['p1'])
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(p.onDone).toHaveBeenCalledTimes(1)
  })
})
