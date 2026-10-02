// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import type { Game, BuzzEvent } from '@/db'

const mockGame: Game = {
  id: 'g1',
  name: 'Test Game',
  status: 'active',
  roundIds: [],
  currentRoundIdx: 0,
  currentQuestionIdx: 0,
  joinPolicy: 'open',
  allowLateJoin: true,
  scoringEnabled: true,
  buzzerLocked: false,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'first',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  startedAt: Date.now(),
}

vi.mock('@/hooks/useScoreboard', () => ({
  useScoreboard: () => ({
    entries: [
      { id: 'p1', name: 'Alice', score: 10, kind: 'player' as const },
      { id: 'p2', name: 'Bob', score: 5, kind: 'player' as const },
      { id: 't1', name: 'Team A', score: 15, kind: 'team' as const, members: [
        { id: 'p3', name: 'Charlie', score: 10 },
        { id: 'p4', name: 'Diana', score: 5 },
      ]},
    ],
    adjust: vi.fn(async () => {}),
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
      timestamp: 100,
      gmDecision: null,
      createdAt: Date.now(),
    },
    {
      id: 'b2',
      gameId: 'g1',
      questionId: 'q1',
      playerId: 'p2',
      playerName: 'Bob',
      timestamp: 200,
      gmDecision: 'correct',
      createdAt: Date.now(),
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
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
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
    expect(screen.getByRole('button', { name: /unlock/i })).toBeDisabled()
  })
})

describe('ScoreboardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('shows medal for first place', () => {
    render(<ScoreboardPanel game={mockGame} />)
    const medals = screen.getAllByTestId(/lucide-icon/)
    expect(medals.length).toBeGreaterThan(0)
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
})
