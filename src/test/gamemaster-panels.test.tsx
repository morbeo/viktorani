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
  buzzerLocked: false,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly',
  tiebreakerMode: 'serverOrder',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockLifecycle = {
  pauseGame: vi.fn(async () => ({ status: 'paused' as const })),
  resumeGame: vi.fn(async () => ({ status: 'active' as const })),
  endGame: vi.fn(async () => ({ status: 'ended' as const })),
}

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

describe('GameControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders game name and controls', () => {
    render(
      <GameControls game={mockGame} onGameChange={vi.fn()} lifecycle={mockLifecycle as any} />
    )
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
        lifecycle={mockLifecycle as any}
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
        lifecycle={mockLifecycle as any}
      />
    )
    expect(screen.getByText('Ended')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause game' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End game' })).not.toBeInTheDocument()
  })

  it('pauses the game when pause button is clicked', async () => {
    const onChange = vi.fn()
    render(<GameControls game={mockGame} onGameChange={onChange} lifecycle={mockLifecycle as any} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pause game' }))
    expect(mockLifecycle.pauseGame).toHaveBeenCalledWith(mockGame)
    expect(onChange).toHaveBeenCalledWith({ status: 'paused' })
  })

  it('resumes the game when resume button is clicked', async () => {
    const onChange = vi.fn()
    render(
      <GameControls
        game={{ ...mockGame, status: 'paused' }}
        onGameChange={onChange}
        lifecycle={mockLifecycle as any}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Resume game' }))
    expect(mockLifecycle.resumeGame).toHaveBeenCalledWith({ ...mockGame, status: 'paused' })
    expect(onChange).toHaveBeenCalledWith({ status: 'active' })
  })

  it('opens end game modal when end button is clicked', async () => {
    render(
      <GameControls game={mockGame} onGameChange={vi.fn()} lifecycle={mockLifecycle as any} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'End game' }))
    expect(screen.getByRole('heading', { name: 'End game' })).toBeInTheDocument()
  })

  it('ends the game when confirmed', async () => {
    const onChange = vi.fn()
    render(<GameControls game={mockGame} onGameChange={onChange} lifecycle={mockLifecycle as any} />)
    await userEvent.click(screen.getByRole('button', { name: 'End game' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(mockLifecycle.endGame).toHaveBeenCalledWith(mockGame)
    expect(onChange).toHaveBeenCalledWith({ status: 'ended' })
  })

  it('opens projector screen in a named window', async () => {
    const openSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
    render(
      <GameControls game={mockGame} onGameChange={vi.fn()} lifecycle={mockLifecycle as any} />
    )
    await userEvent.click(screen.getByText('Open screen'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('/admin/game/g1/screen'),
      'viktorani-screen-g1'
    )
    vi.unstubAllGlobals()
  })
})

describe('RosterPanel', () => {
  const teams: Team[] = [
    { id: 't1', gameId: 'g1', name: 'Red Team', color: '#ff0000', icon: 'flame', score: 0 },
    { id: 't2', gameId: 'g1', name: 'Blue Team', color: '#0000ff', icon: 'star', score: 0 },
  ]

  const players: Player[] = [
    {
      id: 'p1',
      gameId: 'g1',
      deviceId: 'device1',
      name: 'Alice',
      score: 10,
      teamId: 't1',
      isAway: false,
      joinedAt: Date.now(),
    },
    {
      id: 'p2',
      gameId: 'g1',
      deviceId: 'device2',
      name: 'Bob',
      score: 5,
      teamId: 't2',
      isAway: false,
      joinedAt: Date.now(),
    },
    {
      id: 'p3',
      gameId: 'g1',
      deviceId: 'device3',
      name: 'Charlie',
      score: 0,
      teamId: null,
      isAway: true,
      joinedAt: Date.now(),
    },
  ]

  it('shows online count badge', () => {
    render(<RosterPanel players={players} teams={teams} onKick={vi.fn()} />)
    expect(screen.getByLabelText('2 players online')).toHaveTextContent('2 online')
  })

  it('renders all players with their details', () => {
    render(<RosterPanel players={players} teams={teams} onKick={vi.fn()} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByText('Red Team')).toBeInTheDocument()
    expect(screen.getByText('Blue Team')).toBeInTheDocument()
    expect(screen.getByText('no team')).toBeInTheDocument()
  })

  it('shows away status for offline players', () => {
    render(<RosterPanel players={players} teams={teams} onKick={vi.fn()} />)
    const awayIcon = screen.getByLabelText('Away')
    expect(awayIcon).toBeInTheDocument()
  })

  it('shows online status for active players', () => {
    render(<RosterPanel players={players} teams={teams} onKick={vi.fn()} />)
    const onlineIcons = screen.getAllByLabelText('Online')
    expect(onlineIcons).toHaveLength(2)
  })

  it('calls onKick when kick button is clicked', async () => {
    const onKick = vi.fn()
    render(<RosterPanel players={players} teams={teams} onKick={onKick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Kick Alice' }))
    expect(onKick).toHaveBeenCalledWith('p1')
  })

  it('shows empty state when no players', () => {
    render(<RosterPanel players={[]} teams={teams} onKick={vi.fn()} />)
    expect(screen.getByText('No players yet')).toBeInTheDocument()
  })

  it('displays player scores', () => {
    render(<RosterPanel players={players} teams={teams} onKick={vi.fn()} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
