// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeamManagerPanel } from '@/components/gamemaster/TeamManagerPanel'
import { SETTINGS_KEY } from '@/lib/app-settings'
import type { Game, Player, Team } from '@/db'

const mockGame: Game = {
  id: 'g1',
  name: 'Test Game',
  status: 'waiting',
  roomId: 'ABC123',
  visibility: {
    players: { showQuestion: true, showAnswers: false, showMedia: true },
    screen: { showQuestion: true, showAnswers: true, showMedia: true },
  },
  roundIds: [],
  currentRoundIdx: 0,
  currentQuestionIdx: 0,
  maxTeams: 0,
  maxPerTeam: 0,
  maxPlayers: 0,
  allowIndividual: true,
  allowLateJoin: true,
  allowRejoin: true,
  rejoinWindowSeconds: 0,
  requireApproval: false,
  allowPlayerTeams: false,
  scoringEnabled: true,
  buzzerEnabled: true,
  buzzerLocked: false,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly',
  tiebreakerMode: 'serverOrder',
  confirmUnruledNavigation: false,
  autoStartTimerOnQuestionShow: false,
  defaultTimerDuration: 60,
  soundEffectsMuted: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const teams: Team[] = [
  {
    id: 't1',
    gameId: 'g1',
    name: 'Red Team',
    color: '#ff0000',
    icon: 'flame',
    score: 0,
    notes: '',
  },
]

const players: Player[] = [
  {
    id: 'p1',
    gameId: 'g1',
    deviceId: 'device1',
    name: 'Alice',
    score: 10,
    teamId: 't1',
    presence: 'connected',
    disconnectedAt: null,
    joinedAt: Date.now(),
    notes: '',
  },
  {
    id: 'p2',
    gameId: 'g1',
    deviceId: 'device2',
    name: 'Bob',
    score: 5,
    teamId: null,
    presence: 'connected',
    disconnectedAt: null,
    joinedAt: Date.now(),
    notes: '',
  },
]

function renderPanel(overrides: Partial<Parameters<typeof TeamManagerPanel>[0]> = {}) {
  return render(
    <TeamManagerPanel
      game={mockGame}
      teams={teams}
      players={players}
      onCreateTeam={vi.fn()}
      onImportFromManaged={vi.fn()}
      onRenameTeam={vi.fn()}
      onDeleteTeam={vi.fn()}
      onUpdateTeamNotes={vi.fn()}
      onSelectTeam={vi.fn()}
      {...overrides}
    />
  )
}

describe('TeamManagerPanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders existing teams with their member count', () => {
    renderPanel()
    expect(screen.getByText('Red Team')).toBeInTheDocument()
    expect(screen.getByText('1 player')).toBeInTheDocument()
  })

  it('selects a team members by clicking its row', async () => {
    const onSelectTeam = vi.fn()
    renderPanel({ onSelectTeam })
    await userEvent.click(screen.getByRole('button', { name: "Select Red Team's members" }))
    expect(onSelectTeam).toHaveBeenCalledWith('t1')
  })

  it('renames a team', async () => {
    const onRenameTeam = vi.fn()
    renderPanel({ onRenameTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Rename Red Team' }))
    const input = screen.getByLabelText('Rename Red Team')
    await userEvent.clear(input)
    await userEvent.type(input, 'Blue Team{Enter}')
    expect(onRenameTeam).toHaveBeenCalledWith('t1', 'Blue Team')
  })

  it('does not rename when the row click target is the rename input', async () => {
    const onSelectTeam = vi.fn()
    renderPanel({ onSelectTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Rename Red Team' }))
    await userEvent.click(screen.getByLabelText('Rename Red Team'))
    expect(onSelectTeam).not.toHaveBeenCalled()
  })

  it('shows and saves notes for a team', async () => {
    const onUpdateTeamNotes = vi.fn()
    renderPanel({ onUpdateTeamNotes })
    await userEvent.click(screen.getByRole('button', { name: 'Red Team notes' }))
    const textarea = screen.getByLabelText('Notes for Red Team')
    await userEvent.type(textarea, 'Bring extra pens')
    await userEvent.tab()
    expect(onUpdateTeamNotes).toHaveBeenCalledWith('t1', 'Bring extra pens')
  })

  it('deletes a team after confirming', async () => {
    const onDeleteTeam = vi.fn()
    renderPanel({ onDeleteTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Delete Red Team' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDeleteTeam).toHaveBeenCalledWith('t1')
  })

  it('skips the confirmation when confirmDestructive is off', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 4, confirmDestructive: false }))
    const onDeleteTeam = vi.fn()
    renderPanel({ onDeleteTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Delete Red Team' }))
    expect(onDeleteTeam).toHaveBeenCalledWith('t1')
  })
})
