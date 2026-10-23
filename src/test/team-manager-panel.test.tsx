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
  autoRemoveAfterMinutes: 0,
  requireApproval: false,
  allowSpectators: false,
  localNetworkOnly: false,
  allowPlayerTeams: false,
  scoringEnabled: true,
  inputType: 'buzzer',
  buzzerLocked: false,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly',
  tiebreakerMode: 'serverOrder',
  confirmUnruledNavigation: false,
  autoAdvanceOnCorrect: false,
  autoAdvanceOnTimerExpiry: false,
  autoAdvanceDelaySeconds: 5,
  revealTiming: 'manual',
  answersClose: 'perQuestion',
  teamAnswering: 'anyone',
  rankTies: 'share',
  holdScores: false,
  scoresAnnouncedAt: null,
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

  it('selects a team members with the keyboard', async () => {
    const onSelectTeam = vi.fn()
    renderPanel({ onSelectTeam })
    screen.getByRole('button', { name: "Select Red Team's members" }).focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onSelectTeam).toHaveBeenCalledTimes(2)
  })

  it('shows the per-team and team limits', () => {
    renderPanel({ game: { ...mockGame, maxPerTeam: 4, maxTeams: 3 } })
    expect(screen.getByText('1 / 4 player')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('cancels a rename with Escape or the cancel button', async () => {
    const onRenameTeam = vi.fn()
    renderPanel({ onRenameTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Rename Red Team' }))
    await userEvent.type(screen.getByLabelText('Rename Red Team'), 'X{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Rename Red Team' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Rename Red Team' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel rename' }))
    expect(screen.queryByRole('textbox', { name: 'Rename Red Team' })).not.toBeInTheDocument()
    expect(onRenameTeam).not.toHaveBeenCalled()
  })

  it('saves a rename with the save button but skips an unchanged name', async () => {
    const onRenameTeam = vi.fn()
    renderPanel({ onRenameTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Rename Red Team' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(onRenameTeam).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Rename Red Team' }))
    await userEvent.type(screen.getByLabelText('Rename Red Team'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(onRenameTeam).toHaveBeenCalledWith('t1', 'Red Team!')
  })

  it('keeps a team when the delete confirmation is cancelled', async () => {
    const onDeleteTeam = vi.fn()
    renderPanel({ onDeleteTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Delete Red Team' }))
    expect(screen.getByText(/Its 1 member will become unassigned/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onDeleteTeam).not.toHaveBeenCalled()
  })

  it('creates a team with the chosen colour and icon, then resets the form', async () => {
    const onCreateTeam = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onCreateTeam })
    await userEvent.click(screen.getByRole('button', { name: 'Select colour #e67e22' }))
    await userEvent.click(screen.getByRole('button', { name: 'Pick team icon' }))
    await userEvent.click(screen.getByRole('button', { name: 'Swords' }))
    await userEvent.type(screen.getByLabelText('New team name'), '  Owls  ')
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }))
    expect(onCreateTeam).toHaveBeenCalledWith('Owls', '#e67e22', 'Swords')
    expect(screen.getByLabelText('New team name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Select colour #e74c3c' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('creates a team on Enter and ignores a blank name', async () => {
    const onCreateTeam = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onCreateTeam })
    await userEvent.type(screen.getByLabelText('New team name'), '   {Enter}')
    expect(onCreateTeam).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('New team name'), 'Owls{Enter}')
    expect(onCreateTeam).toHaveBeenCalledWith('Owls', '#e74c3c', 'Shield')
  })

  it('shows the error when creating a team fails', async () => {
    const onCreateTeam = vi.fn().mockRejectedValue(new Error('Name taken'))
    renderPanel({ onCreateTeam })
    await userEvent.type(screen.getByLabelText('New team name'), 'Owls{Enter}')
    expect(await screen.findByText('Name taken')).toBeInTheDocument()
    expect(screen.getByLabelText('New team name')).toHaveValue('Owls')
  })

  it('falls back to a generic error for non-Error rejections', async () => {
    const onCreateTeam = vi.fn().mockRejectedValue('nope')
    renderPanel({ onCreateTeam })
    await userEvent.type(screen.getByLabelText('New team name'), 'Owls{Enter}')
    expect(await screen.findByText('Failed to create team')).toBeInTheDocument()
  })

  it('hides the create form at the team limit', () => {
    renderPanel({ game: { ...mockGame, maxTeams: 1 } })
    expect(screen.getByText('Team limit reached (1)')).toBeInTheDocument()
    expect(screen.queryByLabelText('New team name')).not.toBeInTheDocument()
  })

  it('imports teams from the management page', async () => {
    const onImportFromManaged = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onImportFromManaged })
    await userEvent.click(screen.getByRole('button', { name: /Import/ }))
    expect(onImportFromManaged).toHaveBeenCalledTimes(1)
  })

  it.each([
    [new Error('No teams to import'), 'No teams to import'],
    ['nope', 'Import failed'],
  ])('shows the import error (%s)', async (reason, message) => {
    const onImportFromManaged = vi.fn().mockRejectedValue(reason)
    renderPanel({ onImportFromManaged })
    await userEvent.click(screen.getByRole('button', { name: /Import/ }))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})
