// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameControls } from '@/components/gamemaster/GameControls'
import { RosterPanel } from '@/components/gamemaster/RosterPanel'
import type { Game, Player, Team } from '@/db'

const mockGame: Game = {
  id: 'g1',
  name: 'Test Game',
  status: 'active',
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
  allowIndividual: true,
  allowLateJoin: true,
  allowRejoin: true,
  requireApproval: false,
  allowPlayerTeams: false,
  scoringEnabled: true,
  buzzerEnabled: true,
  buzzerLocked: false,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly',
  tiebreakerMode: 'serverOrder',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockLifecycle = {
  pauseGame: vi.fn(async () => ({ status: 'paused' as const, updatedAt: 0 })),
  resumeGame: vi.fn(async () => ({ status: 'active' as const, updatedAt: 0 })),
  endGame: vi.fn(async () => ({ status: 'ended' as const, updatedAt: 0 })),
}

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

describe('GameControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders game name and controls', () => {
    render(<GameControls game={mockGame} onGameChange={vi.fn()} lifecycle={mockLifecycle} />)
    expect(screen.getByText('Test Game')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End game' })).toBeInTheDocument()
    expect(screen.getByText('Open screen')).toBeInTheDocument()
  })

  it('shows paused badge when game is paused', () => {
    render(
      <GameControls
        game={{ ...mockGame, status: 'paused' }}
        onGameChange={vi.fn()}
        lifecycle={mockLifecycle}
      />
    )
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume game' })).toBeInTheDocument()
  })

  it('shows ended badge and hides controls when ended', () => {
    render(
      <GameControls
        game={{ ...mockGame, status: 'ended' }}
        onGameChange={vi.fn()}
        lifecycle={mockLifecycle}
      />
    )
    expect(screen.getByText('Ended')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause game' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End game' })).not.toBeInTheDocument()
  })

  it('pauses the game when pause button is clicked', async () => {
    const onChange = vi.fn()
    render(<GameControls game={mockGame} onGameChange={onChange} lifecycle={mockLifecycle} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pause game' }))
    expect(mockLifecycle.pauseGame).toHaveBeenCalledWith(mockGame)
    expect(onChange).toHaveBeenCalledWith({ status: 'paused', updatedAt: 0 })
  })

  it('resumes the game when resume button is clicked', async () => {
    const onChange = vi.fn()
    render(
      <GameControls
        game={{ ...mockGame, status: 'paused' }}
        onGameChange={onChange}
        lifecycle={mockLifecycle}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Resume game' }))
    expect(mockLifecycle.resumeGame).toHaveBeenCalledWith({ ...mockGame, status: 'paused' })
    expect(onChange).toHaveBeenCalledWith({ status: 'active', updatedAt: 0 })
  })

  it('opens end game modal when end button is clicked', async () => {
    render(<GameControls game={mockGame} onGameChange={vi.fn()} lifecycle={mockLifecycle} />)
    await userEvent.click(screen.getByRole('button', { name: 'End game' }))
    expect(screen.getByRole('heading', { name: 'End game?' })).toBeInTheDocument()
  })

  it('ends the game when confirmed', async () => {
    const onChange = vi.fn()
    render(<GameControls game={mockGame} onGameChange={onChange} lifecycle={mockLifecycle} />)
    await userEvent.click(screen.getByRole('button', { name: 'End game' }))
    // The toolbar button and the modal's confirm button share the name; the modal's is last
    const [, confirm] = screen.getAllByRole('button', { name: 'End game' })
    await userEvent.click(confirm)
    expect(mockLifecycle.endGame).toHaveBeenCalledWith(mockGame)
    expect(onChange).toHaveBeenCalledWith({ status: 'ended', updatedAt: 0 })
  })

  it('opens projector screen in a named window', async () => {
    const openSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
    render(<GameControls game={mockGame} onGameChange={vi.fn()} lifecycle={mockLifecycle} />)
    await userEvent.click(screen.getByText('Open screen'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('/admin/game/g1/screen'),
      'viktorani-screen-g1'
    )
    vi.unstubAllGlobals()
  })
})

describe('RosterPanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

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
    {
      id: 't2',
      gameId: 'g1',
      name: 'Blue Team',
      color: '#0000ff',
      icon: 'star',
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
      joinedAt: Date.now(),
      notes: '',
    },
    {
      id: 'p2',
      gameId: 'g1',
      deviceId: 'device2',
      name: 'Bob',
      score: 5,
      teamId: 't2',
      presence: 'connected',
      joinedAt: Date.now(),
      notes: '',
    },
    {
      id: 'p3',
      gameId: 'g1',
      deviceId: 'device3',
      name: 'Charlie',
      score: 0,
      teamId: null,
      presence: 'disconnected',
      joinedAt: Date.now(),
      notes: '',
    },
  ]

  it('counts connected players, with disconnected ones apart', () => {
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    expect(screen.getByText('2 connected · 1 disconnected')).toBeInTheDocument()
  })

  it('renders all players with their details', () => {
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Red Team')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Blue Team')).toBeInTheDocument()
    expect(screen.getByDisplayValue('No team')).toBeInTheDocument()
  })

  it('shows each presence with its own label and explanation', () => {
    const presences = ['connected', 'hidden', 'disconnected', 'left', 'kicked'] as const
    const everyone = presences.map((presence, i) => ({
      ...players[0],
      id: `p${i}`,
      name: `Player ${i}`,
      presence,
    }))
    render(
      <RosterPanel
        game={mockGame}
        players={everyone}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    expect(screen.getByRole('img', { name: 'Connected' })).toHaveAttribute(
      'title',
      'Connected: Playing.'
    )
    expect(screen.getByRole('img', { name: 'Tab hidden' })).toHaveAttribute(
      'title',
      'Tab hidden: Connected, but looking at something else.'
    )
    expect(screen.getByRole('img', { name: 'Disconnected' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Left' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Kicked' })).toBeInTheDocument()
    expect(screen.getByText('1 connected · 1 tab hidden · 1 disconnected')).toBeInTheDocument()
  })

  it('calls onKick when kick button is clicked', async () => {
    const onKick = vi.fn()
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={onKick}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Kick Alice' }))
    expect(onKick).toHaveBeenCalledWith('p1')
  })

  it('shows empty state when no players', () => {
    render(
      <RosterPanel
        game={mockGame}
        players={[]}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    expect(screen.getByText('No players yet')).toBeInTheDocument()
  })

  it('displays player scores', () => {
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('adds a player with the add-player form', async () => {
    const onAddPlayer = vi.fn()
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={onAddPlayer}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add player' }))
    await userEvent.type(screen.getByLabelText('New player name'), 'Dana')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAddPlayer).toHaveBeenCalledWith('Dana', null)
  })

  it('assigns a player to a team from the roster', async () => {
    const onAssignPlayer = vi.fn()
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={onAssignPlayer}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    await userEvent.selectOptions(screen.getByLabelText('Assign Charlie to team'), 't1')
    expect(onAssignPlayer).toHaveBeenCalledWith('p3', 't1')
  })

  it('selects players and assigns them to a team in bulk', async () => {
    const onAssignPlayer = vi.fn()
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={onAssignPlayer}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    await userEvent.click(screen.getByLabelText('Select Alice'))
    await userEvent.click(screen.getByLabelText('Select Bob'))
    await userEvent.click(screen.getByRole('button', { name: 'Assign team to selected players' }))
    await userEvent.click(screen.getByRole('button', { name: 'Blue Team' }))
    expect(onAssignPlayer).toHaveBeenCalledWith('p1', 't2')
    expect(onAssignPlayer).toHaveBeenCalledWith('p2', 't2')
  })

  it('selects players and kicks them in bulk, after confirming', async () => {
    const onKick = vi.fn()
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={onKick}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
      />
    )
    await userEvent.click(screen.getByLabelText('Select Alice'))
    await userEvent.click(screen.getByRole('button', { name: 'Kick selected players' }))
    await userEvent.click(screen.getByRole('button', { name: 'Kick' }))
    expect(onKick).toHaveBeenCalledWith('p1')
  })

  it('shows and saves notes for a player', async () => {
    const onUpdatePlayerNotes = vi.fn()
    render(
      <RosterPanel
        game={mockGame}
        players={players}
        teams={teams}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={onUpdatePlayerNotes}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Alice notes' }))
    const textarea = screen.getByLabelText('Notes for Alice')
    await userEvent.type(textarea, 'Allergic to trick questions')
    await userEvent.tab()
    expect(onUpdatePlayerNotes).toHaveBeenCalledWith('p1', 'Allergic to trick questions')
  })
})
