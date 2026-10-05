// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import type { Game, BuzzEvent, ScoreEvent } from '@/db'

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
  maxPlayers: 0,
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

const { mockSet, mockHistory } = vi.hoisted(() => ({
  mockSet: vi.fn<(id: string, kind: 'player' | 'team', score: number) => Promise<void>>(
    async () => {}
  ),
  mockHistory: { current: [] as ScoreEvent[] },
}))

vi.mock('@/hooks/useScoreboard', () => ({
  useScoreHistory: () => mockHistory.current,
  useScoreboard: () => ({
    entries: [
      { id: 'p1', name: 'Alice', score: 10, kind: 'player' as const },
      { id: 'p2', name: 'Bob', score: 5, kind: 'player' as const },
      {
        id: 't1',
        name: 'Team A',
        score: 15,
        kind: 'team' as const,
        members: [
          { id: 'p3', name: 'Charlie', score: 10 },
          { id: 'p4', name: 'Diana', score: 5 },
        ],
      },
    ],
    adjust: vi.fn(async () => {}),
    set: mockSet,
    defaultIncrement: 10,
  }),
}))

vi.mock('@/components/ui', async () => {
  const actual = await vi.importActual('@/components/ui')
  return {
    ...actual,
    useControlSizeStep: () => 1,
    pickBySize: (_step: number, sizes: readonly string[]) => sizes[1],
  }
})

describe('BuzzerPanel', () => {
  const buzzes: BuzzEvent[] = [
    {
      id: 'b1',
      gameId: 'g1',
      questionId: 'q1',
      playerId: 'p1',
      playerName: 'Alice',
      teamId: null,
      timestamp: 100,
      receivedAt: Date.now(),
      isFalseStart: false,
      gmDecision: null,
      decidedAt: null,
    },
    {
      id: 'b2',
      gameId: 'g1',
      questionId: 'q1',
      playerId: 'p2',
      playerName: 'Bob',
      teamId: null,
      timestamp: 200,
      receivedAt: Date.now() + 100,
      isFalseStart: false,
      gmDecision: 'Correct',
      decidedAt: Date.now() + 200,
    },
  ]

  it('renders buzzer lock button', () => {
    render(
      <BuzzerPanel
        game={mockGame}
        questionId="q1"
        buzzes={buzzes}
        displayBuzzes={buzzes}
        onToggleLock={vi.fn()}
        onAdjudicate={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText('Buzzer Open')).toBeInTheDocument()
  })

  it('shows locked state when buzzer is locked', () => {
    render(
      <BuzzerPanel
        game={{ ...mockGame, buzzerLocked: true }}
        questionId="q1"
        buzzes={buzzes}
        displayBuzzes={buzzes}
        onToggleLock={vi.fn()}
        onAdjudicate={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText('Buzzer Locked')).toBeInTheDocument()
  })

  it('calls onToggleLock when lock button is clicked', async () => {
    const onToggleLock = vi.fn()
    render(
      <BuzzerPanel
        game={mockGame}
        questionId="q1"
        buzzes={buzzes}
        displayBuzzes={buzzes}
        onToggleLock={onToggleLock}
        onAdjudicate={vi.fn()}
        onClear={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /click to lock/i }))
    expect(onToggleLock).toHaveBeenCalled()
  })

  it('shows pending count badge', () => {
    render(
      <BuzzerPanel
        game={mockGame}
        questionId="q1"
        buzzes={buzzes}
        displayBuzzes={buzzes}
        onToggleLock={vi.fn()}
        onAdjudicate={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText('1 pending')).toBeInTheDocument()
  })

  it('shows clear button when buzzes exist', () => {
    render(
      <BuzzerPanel
        game={mockGame}
        questionId="q1"
        buzzes={buzzes}
        displayBuzzes={buzzes}
        onToggleLock={vi.fn()}
        onAdjudicate={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByTitle('Clear all buzzes for this question')).toBeInTheDocument()
  })

  it('calls onClear when clear button is clicked', async () => {
    const onClear = vi.fn()
    render(
      <BuzzerPanel
        game={mockGame}
        questionId="q1"
        buzzes={buzzes}
        displayBuzzes={buzzes}
        onToggleLock={vi.fn()}
        onAdjudicate={vi.fn()}
        onClear={onClear}
      />
    )
    await userEvent.click(screen.getByTitle('Clear all buzzes for this question'))
    expect(onClear).toHaveBeenCalled()
  })

  it('shows active settings when enabled', () => {
    render(
      <BuzzerPanel
        game={{
          ...mockGame,
          autoLockOnFirstCorrect: true,
          allowFalseStarts: true,
          buzzDeduplication: 'all',
        }}
        questionId="q1"
        buzzes={buzzes}
        displayBuzzes={buzzes}
        onToggleLock={vi.fn()}
        onAdjudicate={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText('Auto-lock on correct: on')).toBeInTheDocument()
    expect(screen.getByText('False starts: recorded')).toBeInTheDocument()
    expect(screen.getByText('Show all buzz attempts')).toBeInTheDocument()
  })

  it('disables lock button when no question is selected', () => {
    render(
      <BuzzerPanel
        game={mockGame}
        questionId={null}
        buzzes={[]}
        displayBuzzes={[]}
        onToggleLock={vi.fn()}
        onAdjudicate={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /click to lock/i })).toBeDisabled()
  })
})

describe('ScoreboardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHistory.current = []
  })

  it('renders scoreboard with entries', () => {
    render(<ScoreboardPanel game={mockGame} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Team A')).toBeInTheDocument()
  })

  it('shows default increment in header', () => {
    render(<ScoreboardPanel game={mockGame} />)
    expect(screen.getByText('±10 per click')).toBeInTheDocument()
  })

  it('displays scores for each entry', () => {
    render(<ScoreboardPanel game={mockGame} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('hides panel when scoring is disabled', () => {
    const { container } = render(<ScoreboardPanel game={{ ...mockGame, scoringEnabled: false }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('expands team to show members', async () => {
    render(<ScoreboardPanel game={mockGame} />)
    await userEvent.click(screen.getByLabelText('Team A — expand team'))
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByText('Diana')).toBeInTheDocument()
  })

  it('collapses expanded team', async () => {
    render(<ScoreboardPanel game={mockGame} />)
    const teamButton = screen.getByLabelText('Team A — expand team')
    await userEvent.click(teamButton)
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Team A — collapse team'))
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument()
  })

  it('shows team label for team entries', () => {
    render(<ScoreboardPanel game={mockGame} />)
    expect(screen.getByText('· team')).toBeInTheDocument()
  })

  it('sets a typed score on Enter', async () => {
    render(<ScoreboardPanel game={mockGame} />)
    await userEvent.click(screen.getByRole('button', { name: 'Set score for Alice, now 10' }))
    const input = screen.getByRole('spinbutton', { name: 'New score for Alice' })
    await userEvent.clear(input)
    await userEvent.type(input, '42{Enter}')

    expect(mockSet).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith('p1', 'player', 42)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('cancels a typed score on Esc', async () => {
    render(<ScoreboardPanel game={mockGame} />)
    await userEvent.click(screen.getByRole('button', { name: 'Set score for Bob, now 5' }))
    const input = screen.getByRole('spinbutton', { name: 'New score for Bob' })
    await userEvent.type(input, '7{Escape}')

    expect(mockSet).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Set score for Bob, now 5' })).toBeInTheDocument()
  })

  it('lists the score history, newest first, when opened', async () => {
    const change = { gameId: 'g1', kind: 'player' as const, questionId: null }
    mockHistory.current = [
      {
        ...change,
        id: 's2',
        targetId: 'p2',
        name: 'Bob',
        from: 0,
        to: 5,
        reason: 'set',
        timestamp: 2,
      },
      {
        ...change,
        id: 's1',
        targetId: 'p1',
        name: 'Alice',
        from: 9,
        to: 10,
        reason: 'correct',
        timestamp: 1,
      },
    ]
    render(<ScoreboardPanel game={mockGame} />)
    await userEvent.click(screen.getByRole('button', { name: /score history \(2\)/i }))

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Bob0 → 5set')
    expect(items[1]).toHaveTextContent('Alice9 → 10correct answer')
  })
})
