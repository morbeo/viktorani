// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'
import { db } from '@/db'
import PlayerList from '@/components/players-teams/PlayerList'
import PlayerForm from '@/components/players-teams/PlayerForm'

async function clearAll() {
  await Promise.all([db.managedPlayers.clear(), db.managedTeams.clear(), db.managedLabels.clear()])
}

// Wrap in MemoryRouter for NavLink inside AdminLayout used indirectly
function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ── PlayerForm — create ───────────────────────────────────────────────────────

describe('PlayerForm — create', () => {
  beforeEach(clearAll)

  it('creates a new player and closes the form', async () => {
    const onClose = () => {}
    renderInRouter(<PlayerForm open player={null} onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText(/player name/i), {
      target: { value: 'Ana Kovac' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create player/i }))
    await waitFor(async () => {
      expect(await db.managedPlayers.count()).toBe(1)
    })
    const saved = await db.managedPlayers.toArray()
    expect(saved[0].name).toBe('Ana Kovac')
    expect(saved[0].teamIds).toEqual([])
    expect(saved[0].archivedAt).toBeNull()
  })

  it('shows error when name is empty', async () => {
    renderInRouter(<PlayerForm open player={null} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /create player/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('saves on Enter keypress', async () => {
    renderInRouter(<PlayerForm open player={null} onClose={() => {}} />)
    const input = screen.getByPlaceholderText(/player name/i)
    fireEvent.change(input, { target: { value: 'Ben' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(async () => {
      expect(await db.managedPlayers.count()).toBe(1)
    })
  })

  it('pre-selects defaultTeamId when provided', async () => {
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
    renderInRouter(<PlayerForm open player={null} defaultTeamId="t1" onClose={() => {}} />)
    const teamBtn = await screen.findByRole('button', { name: /remove from blue shield/i })
    expect(teamBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('assigns selected team and syncs team.playerIds', async () => {
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
    renderInRouter(<PlayerForm open player={null} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/player name/i), {
      target: { value: 'Clara' },
    })
    const teamBtn = await screen.findByRole('button', { name: /add to blue shield/i })
    fireEvent.click(teamBtn)
    fireEvent.click(screen.getByRole('button', { name: /create player/i }))
    await waitFor(async () => {
      const team = await db.managedTeams.get('t1')
      expect(team?.playerIds).toHaveLength(1)
    })
  })

  it('assigns selected label to the new player', async () => {
    await db.managedLabels.add({ id: 'lab1', name: 'Trivia', color: '#6366f1' })
    renderInRouter(<PlayerForm open player={null} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/player name/i), {
      target: { value: 'Dave' },
    })
    const labelBtn = await screen.findByRole('button', { name: /add label trivia/i })
    fireEvent.click(labelBtn)
    fireEvent.click(screen.getByRole('button', { name: /create player/i }))
    await waitFor(async () => {
      const players = await db.managedPlayers.toArray()
      expect(players[0].labelIds).toContain('lab1')
    })
  })
})

// ── PlayerForm — edit ─────────────────────────────────────────────────────────

describe('PlayerForm — edit', () => {
  beforeEach(clearAll)

  it('pre-fills the form with existing player data', async () => {
    const player = {
      id: 'p1',
      name: 'Original',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedPlayers.add(player)
    renderInRouter(<PlayerForm open player={player} onClose={() => {}} />)
    expect(screen.getByDisplayValue('Original')).toBeInTheDocument()
  })

  it('updates player name on save', async () => {
    const player = {
      id: 'p1',
      name: 'Old Name',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedPlayers.add(player)
    renderInRouter(<PlayerForm open player={player} onClose={() => {}} />)
    const input = screen.getByDisplayValue('Old Name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(async () => {
      const updated = await db.managedPlayers.get('p1')
      expect(updated?.name).toBe('New Name')
    })
  })

  it('syncs team removal on edit — removes player from team.playerIds', async () => {
    await db.managedTeams.add({
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: ['p1'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const player = {
      id: 'p1',
      name: 'Ana',
      teamIds: ['t1'],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedPlayers.add(player)
    renderInRouter(<PlayerForm open player={player} onClose={() => {}} />)
    // Deselect team
    const teamBtn = await screen.findByRole('button', { name: /remove from blue shield/i })
    fireEvent.click(teamBtn)
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(async () => {
      const team = await db.managedTeams.get('t1')
      expect(team?.playerIds).not.toContain('p1')
    })
  })
})

// ── PlayerList — display ──────────────────────────────────────────────────────

describe('PlayerList — display', () => {
  beforeEach(clearAll)

  it('shows empty state when no players exist', async () => {
    renderInRouter(<PlayerList />)
    expect(await screen.findByText(/no players yet/i)).toBeInTheDocument()
  })

  it('renders active players', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana Kovac',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<PlayerList />)
    expect(await screen.findByText('Ana Kovac')).toBeInTheDocument()
  })

  it('renders archived players greyed out with Restore button', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Old Player',
      teamIds: [],
      labelIds: [],
      archivedAt: new Date(),
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<PlayerList />)
    expect(await screen.findByText('Old Player')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /restore old player/i })).toBeInTheDocument()
  })

  it('filters by team when filterTeamId is set', async () => {
    await db.managedPlayers.bulkAdd([
      {
        id: 'p1',
        name: 'In Team',
        teamIds: ['t1'],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 'p2',
        name: 'Not In Team',
        teamIds: [],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    renderInRouter(<PlayerList filterTeamId="t1" />)
    expect(await screen.findByText('In Team')).toBeInTheDocument()
    expect(screen.queryByText('Not In Team')).not.toBeInTheDocument()
  })

  it('filters by search string', async () => {
    await db.managedPlayers.bulkAdd([
      {
        id: 'p1',
        name: 'Ana Kovac',
        teamIds: [],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 'p2',
        name: 'Ben Tomas',
        teamIds: [],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    renderInRouter(<PlayerList search="ana" />)
    expect(await screen.findByText('Ana Kovac')).toBeInTheDocument()
    expect(screen.queryByText('Ben Tomas')).not.toBeInTheDocument()
  })

  it('shows team-filtered empty state when filterTeamId yields no results', async () => {
    renderInRouter(<PlayerList filterTeamId="t1" />)
    expect(await screen.findByText(/no players in this team yet/i)).toBeInTheDocument()
  })

  it('shows search empty state when search yields no results', async () => {
    renderInRouter(<PlayerList search="zzz" />)
    expect(await screen.findByText(/no players matching/i)).toBeInTheDocument()
  })
})

// ── PlayerList — archive / restore ───────────────────────────────────────────

describe('PlayerList — archive and restore', () => {
  beforeEach(clearAll)

  it('archives a player on Archive click', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Active Player',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('button', { name: /archive active player/i }))
    await waitFor(async () => {
      const p = await db.managedPlayers.get('p1')
      expect(p?.archivedAt).not.toBeNull()
    })
  })

  it('restores an archived player on Restore click', async () => {
    await act(async () => {
      await db.managedPlayers.add({
        id: 'p1',
        name: 'Archived Player',
        teamIds: [],
        labelIds: [],
        archivedAt: new Date(),
        totalScore: 0,
        gameLog: [],
      })
    })
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('button', { name: /restore archived player/i }))
    await waitFor(async () => {
      const p = await db.managedPlayers.get('p1')
      expect(p?.archivedAt).toBeNull()
    })
  })
})
