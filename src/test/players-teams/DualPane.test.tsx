// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/db'
import LabelFilterChips from '@/components/players-teams/LabelFilterChips'
import TeamList from '@/components/players-teams/TeamList'
import PlayerList from '@/components/players-teams/PlayerList'

async function clearAll() {
  await Promise.all([db.managedPlayers.clear(), db.managedTeams.clear(), db.managedLabels.clear()])
}

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ── LabelFilterChips ──────────────────────────────────────────────────────────

describe('LabelFilterChips', () => {
  beforeEach(clearAll)

  it('renders nothing when no labels exist', async () => {
    const { container } = renderInRouter(<LabelFilterChips filter={{}} onChange={() => {}} />)
    // useLiveQuery resolves async; wait a tick then assert empty
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders All chip and one chip per label', async () => {
    await db.managedLabels.bulkAdd([
      { id: 'l1', name: 'Trivia', color: '#6366f1' },
      { id: 'l2', name: 'Sports', color: '#e67e22' },
    ])
    renderInRouter(<LabelFilterChips filter={{}} onChange={() => {}} />)
    expect(await screen.findByRole('button', { name: /show all labels/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /label trivia/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /label sports/i })).toBeInTheDocument()
  })

  it('cycles neutral -> include -> exclude -> neutral on click', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    const onChange = vi.fn()
    const { rerender } = renderInRouter(<LabelFilterChips filter={{}} onChange={onChange} />)
    const btn = await screen.findByRole('button', { name: /label trivia: neutral/i })

    // neutral -> include
    fireEvent.click(btn)
    expect(onChange).toHaveBeenLastCalledWith({ l1: 'include' })

    rerender(
      <MemoryRouter>
        <LabelFilterChips filter={{ l1: 'include' }} onChange={onChange} />
      </MemoryRouter>
    )
    const btnInclude = screen.getByRole('button', { name: /label trivia: include/i })

    // include -> exclude
    fireEvent.click(btnInclude)
    expect(onChange).toHaveBeenLastCalledWith({ l1: 'exclude' })

    rerender(
      <MemoryRouter>
        <LabelFilterChips filter={{ l1: 'exclude' }} onChange={onChange} />
      </MemoryRouter>
    )
    const btnExclude = screen.getByRole('button', { name: /label trivia: exclude/i })

    // exclude -> neutral (key deleted)
    fireEvent.click(btnExclude)
    expect(onChange).toHaveBeenLastCalledWith({})
  })

  it('resets all filters when All chip is clicked', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    const onChange = vi.fn()
    renderInRouter(<LabelFilterChips filter={{ l1: 'include' }} onChange={onChange} />)
    fireEvent.click(await screen.findByRole('button', { name: /show all labels/i }))
    expect(onChange).toHaveBeenCalledWith({})
  })
})

// ── TeamList — label filter ───────────────────────────────────────────────────

describe('TeamList — label filter', () => {
  beforeEach(clearAll)

  it('shows only teams with an included label', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    await db.managedTeams.bulkAdd([
      {
        id: 't1',
        name: 'Blue Shield',
        color: '#3a57b7',
        icon: 'Shield',
        labelIds: ['l1'],
        playerIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 't2',
        name: 'Green Sparks',
        color: '#2d7a46',
        icon: 'Zap',
        labelIds: [],
        playerIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    renderInRouter(<TeamList labelFilter={{ l1: 'include' }} />)
    expect(await screen.findByText('Blue Shield')).toBeInTheDocument()
    expect(screen.queryByText('Green Sparks')).not.toBeInTheDocument()
  })

  it('hides teams with an excluded label', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Sports', color: '#e67e22' })
    await db.managedTeams.bulkAdd([
      {
        id: 't1',
        name: 'Sports Team',
        color: '#e74c3c',
        icon: 'Trophy',
        labelIds: ['l1'],
        playerIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 't2',
        name: 'Other Team',
        color: '#3a57b7',
        icon: 'Shield',
        labelIds: [],
        playerIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    renderInRouter(<TeamList labelFilter={{ l1: 'exclude' }} />)
    expect(await screen.findByText('Other Team')).toBeInTheDocument()
    expect(screen.queryByText('Sports Team')).not.toBeInTheDocument()
  })
})

// ── PlayerList — label filter ─────────────────────────────────────────────────

describe('PlayerList — label filter', () => {
  beforeEach(clearAll)

  it('shows only players with an included label', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
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
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    renderInRouter(<PlayerList labelFilter={{ l1: 'include' }} />)
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.queryByText('Ben')).not.toBeInTheDocument()
  })

  it('hides players with an excluded label', async () => {
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
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    renderInRouter(<PlayerList labelFilter={{ l1: 'exclude' }} />)
    expect(await screen.findByText('Ben')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  it('combines team filter and label filter', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    await db.managedPlayers.bulkAdd([
      {
        id: 'p1',
        name: 'In Team + Label',
        teamIds: ['t1'],
        labelIds: ['l1'],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 'p2',
        name: 'In Team No Label',
        teamIds: ['t1'],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 'p3',
        name: 'No Team',
        teamIds: [],
        labelIds: ['l1'],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    renderInRouter(<PlayerList filterTeamId="t1" labelFilter={{ l1: 'include' }} />)
    expect(await screen.findByText('In Team + Label')).toBeInTheDocument()
    expect(screen.queryByText('In Team No Label')).not.toBeInTheDocument()
    expect(screen.queryByText('No Team')).not.toBeInTheDocument()
  })
})

// ── Mobile tab switcher ───────────────────────────────────────────────────────

describe('PlayersTeams — mobile tab switcher', () => {
  beforeEach(clearAll)

  it('switches to players tab when a team is selected', async () => {
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
    // Import lazily to avoid AdminLayout rendering issues in tests
    const { default: PlayersTeams } = await import('@/pages/admin/PlayersTeams')
    renderInRouter(<PlayersTeams />)

    // Teams tab is active by default — players panel should have aria-label
    const teamsPanel = screen.getByRole('tabpanel', { name: /teams pane/i })
    expect(teamsPanel).toBeInTheDocument()

    // Click the team row to select it
    const teamBtn = await screen.findByRole('button', { name: /select team blue shield/i })
    fireEvent.click(teamBtn)

    // Players tab should now be active
    const playersTab = screen.getByRole('tab', { name: /players/i })
    expect(playersTab).toHaveAttribute('aria-selected', 'true')
  })
})
