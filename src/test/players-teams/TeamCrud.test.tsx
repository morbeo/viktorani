// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'
import { db } from '@/db'
import { contrastRatio, whiteTextPassesAA } from '@/components/players-teams/contrast'
import TeamForm from '@/components/players-teams/TeamForm'
import TeamList from '@/components/players-teams/TeamList'

async function clearAll() {
  await Promise.all([db.managedTeams.clear(), db.managedLabels.clear(), db.managedPlayers.clear()])
}

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ── contrast utility ──────────────────────────────────────────────────────────

describe('contrastRatio', () => {
  it('returns ~21 for black on white', () => {
    const r = contrastRatio('#000000', '#ffffff')
    expect(r).not.toBeNull()
    expect(r!).toBeCloseTo(21, 0)
  })

  it('returns 1 for identical colours', () => {
    expect(contrastRatio('#aaaaaa', '#aaaaaa')).toBeCloseTo(1, 5)
  })

  it('returns null for invalid hex', () => {
    expect(contrastRatio('not-a-color', '#ffffff')).toBeNull()
  })
})

describe('whiteTextPassesAA', () => {
  it('passes for dark blue (#3a57b7)', () => {
    expect(whiteTextPassesAA('#3a57b7')).toBe(true)
  })

  it('fails for yellow (#f1c40f)', () => {
    expect(whiteTextPassesAA('#f1c40f')).toBe(false)
  })

  it('fails for light grey (#95a5a6)', () => {
    expect(whiteTextPassesAA('#95a5a6')).toBe(false)
  })
})

// ── TeamForm — create ─────────────────────────────────────────────────────────

describe('TeamForm — create', () => {
  beforeEach(clearAll)

  it('creates a new team with default colour and icon', async () => {
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/team name/i), {
      target: { value: 'Blue Shield' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create team/i }))
    await waitFor(async () => {
      expect(await db.managedTeams.count()).toBe(1)
    })
    const saved = await db.managedTeams.toArray()
    expect(saved[0].name).toBe('Blue Shield')
    expect(saved[0].playerIds).toEqual([])
    expect(saved[0].archivedAt).toBeNull()
  })

  it('shows error when name is empty', async () => {
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /create team/i }))
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('saves on Enter keypress', async () => {
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    const input = screen.getByPlaceholderText(/team name/i)
    fireEvent.change(input, { target: { value: 'Quick Team' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(async () => {
      expect(await db.managedTeams.count()).toBe(1)
    })
  })

  it('shows contrast warning for a low-contrast colour', async () => {
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    const colorInput = screen.getByLabelText(/custom colour/i)
    fireEvent.change(colorInput, { target: { value: '#f1c40f' } })
    expect(await screen.findByText(/below wcag aa/i)).toBeInTheDocument()
  })

  it('hides contrast warning after dismiss', async () => {
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/custom colour/i), {
      target: { value: '#f1c40f' },
    })
    expect(await screen.findByText(/below wcag aa/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss contrast warning/i }))
    await waitFor(() => {
      expect(screen.queryByText(/below wcag aa/i)).not.toBeInTheDocument()
    })
  })

  it('does not show contrast warning for a passing colour', async () => {
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    // default colour #3a57b7 passes — warning should not be present
    expect(screen.queryByText(/below wcag aa/i)).not.toBeInTheDocument()
  })

  it('selects a preset colour swatch', async () => {
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /set colour #e74c3c/i }))
    // badge preview background should update — check via aria-label on preview
    const preview = screen.getByLabelText(/team badge preview/i)
    expect(preview).toHaveStyle('background: #e74c3c')
  })

  it('selects an icon from the picker', async () => {
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /select icon Flame/i }))
    const flameBtn = screen.getByRole('button', { name: /select icon Flame/i })
    expect(flameBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('assigns a label to the new team', async () => {
    await db.managedLabels.add({ id: 'lab1', name: 'Trivia', color: '#6366f1' })
    renderInRouter(<TeamForm open team={null} onClose={() => {}} />)
    const labelBtn = await screen.findByRole('button', { name: /add label trivia/i })
    fireEvent.click(labelBtn)
    fireEvent.change(screen.getByPlaceholderText(/team name/i), {
      target: { value: 'Trivia Team' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create team/i }))
    await waitFor(async () => {
      const teams = await db.managedTeams.toArray()
      expect(teams[0].labelIds).toContain('lab1')
    })
  })
})

// ── TeamForm — edit ───────────────────────────────────────────────────────────

describe('TeamForm — edit', () => {
  beforeEach(clearAll)

  it('pre-fills the form with existing team data', async () => {
    const team = {
      id: 't1',
      name: 'Original',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedTeams.add(team)
    renderInRouter(<TeamForm open team={team} onClose={() => {}} />)
    expect(screen.getByDisplayValue('Original')).toBeInTheDocument()
  })

  it('updates team name on save', async () => {
    const team = {
      id: 't1',
      name: 'Old Name',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedTeams.add(team)
    renderInRouter(<TeamForm open team={team} onClose={() => {}} />)
    fireEvent.change(screen.getByDisplayValue('Old Name'), {
      target: { value: 'New Name' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(async () => {
      const updated = await db.managedTeams.get('t1')
      expect(updated?.name).toBe('New Name')
    })
  })

  it('resets contrast dismiss state when form reopens', async () => {
    const team = {
      id: 't1',
      name: 'Yellow',
      color: '#f1c40f',
      icon: 'Star',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedTeams.add(team)
    const { rerender } = renderInRouter(<TeamForm open team={team} onClose={() => {}} />)
    expect(await screen.findByText(/below wcag aa/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss contrast warning/i }))
    await waitFor(() => {
      expect(screen.queryByText(/below wcag aa/i)).not.toBeInTheDocument()
    })
    // Simulate close and reopen
    rerender(
      <MemoryRouter>
        <TeamForm open={false} team={team} onClose={() => {}} />
      </MemoryRouter>
    )
    rerender(
      <MemoryRouter>
        <TeamForm open team={team} onClose={() => {}} />
      </MemoryRouter>
    )
    expect(await screen.findByText(/below wcag aa/i)).toBeInTheDocument()
  })
})

// ── TeamList — display ────────────────────────────────────────────────────────

describe('TeamList — display', () => {
  beforeEach(clearAll)

  it('shows empty state when no teams exist', async () => {
    renderInRouter(<TeamList />)
    expect(await screen.findByText(/no teams yet/i)).toBeInTheDocument()
  })

  it('renders active teams', async () => {
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
    renderInRouter(<TeamList />)
    expect(await screen.findByText('Blue Shield')).toBeInTheDocument()
  })

  it('renders archived teams greyed out with Restore button', async () => {
    await db.managedTeams.add({
      id: 't1',
      name: 'Old Team',
      color: '#888',
      icon: 'Flag',
      labelIds: [],
      playerIds: [],
      archivedAt: new Date(),
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<TeamList />)
    expect(await screen.findByText('Old Team')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /restore old team/i })).toBeInTheDocument()
  })

  it('filters by search string', async () => {
    await db.managedTeams.bulkAdd([
      {
        id: 't1',
        name: 'Blue Shield',
        color: '#3a57b7',
        icon: 'Shield',
        labelIds: [],
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
    renderInRouter(<TeamList search="blue" />)
    expect(await screen.findByText('Blue Shield')).toBeInTheDocument()
    expect(screen.queryByText('Green Sparks')).not.toBeInTheDocument()
  })

  it('shows search empty state when no teams match', async () => {
    renderInRouter(<TeamList search="zzz" />)
    expect(await screen.findByText(/no teams matching/i)).toBeInTheDocument()
  })

  it('calls onSelect with team id when row is clicked', async () => {
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
    const onSelect = vi.fn()
    renderInRouter(<TeamList onSelect={onSelect} />)
    fireEvent.click(await screen.findByRole('button', { name: /select team blue shield/i }))
    expect(onSelect).toHaveBeenCalledWith('t1')
  })

  it('calls onSelect with null when selected team row is clicked again', async () => {
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
    const onSelect = vi.fn()
    renderInRouter(<TeamList onSelect={onSelect} selectedTeamId="t1" />)
    fireEvent.click(await screen.findByRole('button', { name: /deselect team blue shield/i }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})

// ── TeamList — archive / restore ──────────────────────────────────────────────

describe('TeamList — archive and restore', () => {
  beforeEach(clearAll)

  it('archives a team on Archive click', async () => {
    await db.managedTeams.add({
      id: 't1',
      name: 'Active Team',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<TeamList />)
    fireEvent.click(await screen.findByRole('button', { name: /archive active team/i }))
    await waitFor(async () => {
      const t = await db.managedTeams.get('t1')
      expect(t?.archivedAt).not.toBeNull()
    })
  })

  it('restores an archived team on Restore click', async () => {
    await act(async () => {
      await db.managedTeams.add({
        id: 't1',
        name: 'Archived Team',
        color: '#888',
        icon: 'Flag',
        labelIds: [],
        playerIds: [],
        archivedAt: new Date(),
        totalScore: 0,
        gameLog: [],
      })
    })
    renderInRouter(<TeamList />)
    fireEvent.click(await screen.findByRole('button', { name: /restore archived team/i }))
    await waitFor(async () => {
      const t = await db.managedTeams.get('t1')
      expect(t?.archivedAt).toBeNull()
    })
  })

  it('clears selection when the selected team is archived', async () => {
    await db.managedTeams.add({
      id: 't1',
      name: 'Selected Team',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const onSelect = vi.fn()
    renderInRouter(<TeamList onSelect={onSelect} selectedTeamId="t1" />)
    fireEvent.click(await screen.findByRole('button', { name: /archive selected team/i }))
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(null)
    })
  })
})
