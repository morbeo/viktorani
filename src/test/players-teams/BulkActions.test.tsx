// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'
import { db } from '@/db'
import PlayerList from '@/components/players-teams/PlayerList'

async function clearAll() {
  await Promise.all([db.managedPlayers.clear(), db.managedTeams.clear(), db.managedLabels.clear()])
}

async function seedPlayers() {
  await db.managedPlayers.bulkAdd([
    {
      id: 'p1',
      name: 'Ana',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    },
    {
      id: 'p2',
      name: 'Ben',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    },
    {
      id: 'p3',
      name: 'Clara',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    },
  ])
}

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ── Checkboxes and selection ──────────────────────────────────────────────────

describe('BulkActions — checkboxes', () => {
  beforeEach(clearAll)

  it('shows a checkbox on every active player row', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    const boxes = await screen.findAllByRole('checkbox', {
      name: /select ana|select ben|select clara/i,
    })
    expect(boxes).toHaveLength(3)
  })

  it('shows select-all checkbox when active players exist', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    expect(await screen.findByRole('checkbox', { name: /select all players/i })).toBeInTheDocument()
  })

  it('selects a player on checkbox click', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    const cb = await screen.findByRole('checkbox', { name: /select ana/i })
    fireEvent.click(cb)
    expect(cb).toBeChecked()
  })

  it('select-all checks all active players', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    const selectAll = await screen.findByRole('checkbox', { name: /select all players/i })
    fireEvent.click(selectAll)
    const boxes = screen.getAllByRole('checkbox', { name: /select ana|select ben|select clara/i })
    boxes.forEach(cb => expect(cb).toBeChecked())
  })

  it('deselects all when select-all clicked again', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    const selectAll = await screen.findByRole('checkbox', { name: /select all players/i })
    fireEvent.click(selectAll)
    fireEvent.click(selectAll)
    const boxes = screen.getAllByRole('checkbox', { name: /select ana|select ben|select clara/i })
    boxes.forEach(cb => expect(cb).not.toBeChecked())
  })

  it('shows bulk action bar when at least one player is selected', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    expect(await screen.findByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument()
  })

  it('hides bulk action bar after clear selection', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    fireEvent.click(await screen.findByRole('button', { name: /clear selection/i }))
    await waitFor(() => {
      expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument()
    })
  })
})

// ── Assign team ───────────────────────────────────────────────────────────────

describe('BulkActions — assign team', () => {
  beforeEach(clearAll)

  it('adds selected players to the chosen team', async () => {
    await seedPlayers()
    await db.managedTeams.add({
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ben/i }))
    fireEvent.click(screen.getByRole('button', { name: /assign team/i }))
    fireEvent.click(await screen.findByRole('button', { name: /blue shield/i }))
    await waitFor(async () => {
      const [p1, p2] = await Promise.all([db.managedPlayers.get('p1'), db.managedPlayers.get('p2')])
      expect(p1?.teamIds).toContain('t1')
      expect(p2?.teamIds).toContain('t1')
    })
  })
})

// ── Add label ─────────────────────────────────────────────────────────────────

describe('BulkActions — add label', () => {
  beforeEach(clearAll)

  it('adds the label to all selected players', async () => {
    await seedPlayers()
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    fireEvent.click(screen.getByRole('button', { name: /add label to selected/i }))
    fireEvent.click(await screen.findByRole('button', { name: /trivia/i }))
    await waitFor(async () => {
      const p = await db.managedPlayers.get('p1')
      expect(p?.labelIds).toContain('l1')
    })
  })

  it('does not duplicate label if player already has it', async () => {
    await db.managedPlayers.add({
      id: 'px',
      name: 'Dave',
      teamIds: [],
      labelIds: ['l1'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select dave/i }))
    fireEvent.click(screen.getByRole('button', { name: /add label to selected/i }))
    fireEvent.click(await screen.findByRole('button', { name: /trivia/i }))
    await waitFor(async () => {
      const p = await db.managedPlayers.get('px')
      expect(p?.labelIds.filter(id => id === 'l1')).toHaveLength(1)
    })
  })
})

// ── Remove label ──────────────────────────────────────────────────────────────

describe('BulkActions — remove label', () => {
  beforeEach(clearAll)

  it('removes the label from all selected players', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Sports', color: '#e67e22' })
    await db.managedPlayers.bulkAdd([
      {
        id: 'p1',
        name: 'Ana',
        teamIds: [],
        labelIds: ['l1'],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 'p2',
        name: 'Ben',
        teamIds: [],
        labelIds: ['l1'],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ben/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove label from selected/i }))
    fireEvent.click(await screen.findByRole('button', { name: /sports/i }))
    await waitFor(async () => {
      const [p1, p2] = await Promise.all([db.managedPlayers.get('p1'), db.managedPlayers.get('p2')])
      expect(p1?.labelIds).not.toContain('l1')
      expect(p2?.labelIds).not.toContain('l1')
    })
  })
})

// ── Bulk archive (two-step) ───────────────────────────────────────────────────

describe('BulkActions — archive', () => {
  beforeEach(clearAll)

  it('shows confirmation dialog before archiving', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    fireEvent.click(screen.getByRole('button', { name: /archive selected players/i }))
    expect(await screen.findByText(/archive players\?/i)).toBeInTheDocument()
  })

  it('archives selected players after confirmation', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ben/i }))
    fireEvent.click(screen.getByRole('button', { name: /archive selected players/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^archive$/i }))
    await waitFor(async () => {
      const [p1, p2, p3] = await Promise.all([
        db.managedPlayers.get('p1'),
        db.managedPlayers.get('p2'),
        db.managedPlayers.get('p3'),
      ])
      expect(p1?.archivedAt).not.toBeNull()
      expect(p2?.archivedAt).not.toBeNull()
      expect(p3?.archivedAt).toBeNull() // not selected
    })
  })

  it('cancelling the dialog does not archive', async () => {
    await act(async () => {
      await seedPlayers()
    })
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    fireEvent.click(screen.getByRole('button', { name: /archive selected players/i }))
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    await waitFor(async () => {
      const p = await db.managedPlayers.get('p1')
      expect(p?.archivedAt).toBeNull()
    })
  })

  it('clears selection after archiving', async () => {
    await seedPlayers()
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /select ana/i }))
    fireEvent.click(screen.getByRole('button', { name: /archive selected players/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^archive$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument()
    })
  })
})
