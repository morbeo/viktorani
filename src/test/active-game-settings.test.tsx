// @vitest-pool vmForks
// Covers two ActiveGame behaviours gated by new per-game settings:
// confirm-before-navigate on an unruled question, and auto-starting a timer
// when a question is shown. Every other child panel is mocked out so these
// tests only exercise navigation + the timer auto-start effect.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Game, GameQuestion, Round, Timer } from '@/db'
import type { CreateTimerOptions } from '@/hooks/useTimer'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

vi.mock('@/hooks/useBuzzer', () => ({
  useBuzzer: () => ({
    displayBuzzes: [],
    buzzes: [],
    toggleLock: vi.fn(),
    adjudicate: vi.fn(),
    clearBuzzes: vi.fn(),
    handleIncomingBuzz: vi.fn(),
  }),
}))

const { mockTimers, mockCreateTimer, mockStartTimer, mockRestartTimer, mockDeleteTimer } =
  vi.hoisted(() => {
    const mockTimers: Timer[] = []
    const mockCreateTimer = vi.fn(async (opts: CreateTimerOptions) => {
      const t: Timer = {
        id: `timer-${mockCreateTimer.mock.calls.length}`,
        gameId: opts.gameId,
        label: opts.label,
        duration: opts.duration,
        remaining: opts.duration,
        target: 'all',
        message: '',
        visible: true,
        paused: true,
        startedAt: null,
        audioNotify: 'none',
        visualNotify: 'none',
        autoReset: opts.autoReset ?? 'none',
      }
      mockTimers.push(t)
      return t
    })
    return {
      mockTimers,
      mockCreateTimer,
      mockStartTimer: vi.fn(async () => {}),
      mockRestartTimer: vi.fn(async () => {}),
      mockDeleteTimer: vi.fn(async (id: string) => {
        mockTimers.splice(
          mockTimers.findIndex(t => t.id === id),
          1
        )
      }),
    }
  })

vi.mock('@/hooks/useTimer', () => ({
  useTimerList: () => ({
    timers: mockTimers,
    createTimer: mockCreateTimer,
    startTimer: mockStartTimer,
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    restartTimer: mockRestartTimer,
    deleteTimer: mockDeleteTimer,
    updateTimer: vi.fn(),
    pauseAll: vi.fn(),
    resumeAll: vi.fn(),
    restartAll: vi.fn(),
    deleteAll: vi.fn(),
    autoReset: vi.fn(async () => {}),
    remaining: () => 0,
  }),
}))

vi.mock('@/components/gamemaster/RoundInfo', () => ({ RoundInfo: () => null }))
vi.mock('@/components/RoundBoundary', () => ({ RoundBoundary: () => null }))
vi.mock('@/components/buzzer/BuzzerPanel', () => ({ BuzzerPanel: () => null }))
vi.mock('@/components/scoreboard/ScoreboardPanel', () => ({ ScoreboardPanel: () => null }))
vi.mock('@/components/gamemaster/GameControls', () => ({ GameControls: () => null }))
vi.mock('@/components/gamemaster/PendingJoinsPanel', () => ({ PendingJoinsPanel: () => null }))
vi.mock('@/components/gamemaster/RosterPanel', () => ({ RosterPanel: () => null }))
vi.mock('@/components/gamemaster/ScreensPanel', () => ({ ScreensPanel: () => null }))
vi.mock('@/components/gamemaster/MessagePanel', () => ({ MessagePanel: () => null }))
vi.mock('@/components/gamemaster/GameLogPanel', () => ({ GameLogPanel: () => null }))
vi.mock('@/components/host/HostQuestionPanel', () => ({ HostQuestionPanel: () => null }))
vi.mock('@/components/timer/TimerPanel', () => ({ TimerPanel: () => null }))

import { db } from '@/db'
import { transportManager } from '@/transport'
import { ActiveGame } from '@/components/gamemaster/ActiveGame'

const mockSend = vi.mocked(transportManager.send)

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    roomId: 'ROOM1',
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    maxTeams: 0,
    maxPerTeam: 0,
    maxPlayers: 0,
    allowIndividual: true,
    allowLateJoin: true,
    allowRejoin: true,
    rejoinWindowSeconds: 0,
    requireApproval: false,
    allowPlayerTeams: true,
    roundIds: ['r1'],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    scoringEnabled: true,
    buzzerEnabled: false,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    confirmUnruledNavigation: false,
    autoAdvanceOnCorrect: false,
    autoAdvanceOnTimerExpiry: false,
    autoAdvanceDelaySeconds: 5,
    autoStartTimerOnQuestionShow: false,
    defaultTimerDuration: 60,
    soundEffectsMuted: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

const ROUND: Round = {
  id: 'r1',
  name: 'Round 1',
  description: '',
  questionIds: ['q1', 'q2'],
  createdAt: 0,
}

function makeGameQuestion(overrides: Partial<GameQuestion> = {}): GameQuestion {
  return {
    id: 'gq1',
    gameId: 'g1',
    questionId: 'q1',
    roundId: 'r1',
    order: 0,
    status: 'pending',
    ...overrides,
  }
}

function renderActiveGame(game: Game) {
  return render(
    <ActiveGame
      game={game}
      onGameChange={vi.fn()}
      lifecycle={{ pauseGame: vi.fn(), resumeGame: vi.fn(), endGame: vi.fn() }}
      buzzHandlerRef={{ current: null }}
      pendingJoins={[]}
      onApproveJoin={vi.fn()}
      onRejectJoin={vi.fn()}
      players={[]}
      teams={[]}
      onKick={vi.fn()}
      onAddPlayer={vi.fn()}
      onAssignPlayer={vi.fn()}
      onAdjustScore={vi.fn()}
      onUpdatePlayerNotes={vi.fn()}
      onCreateTeam={vi.fn()}
      onQuestionContent={vi.fn()}
      onScreenContent={vi.fn()}
      screens={{
        roomId: 'ROOM1',
        pending: [],
        connected: [],
        onApprove: vi.fn(),
        onReject: vi.fn(),
        onDisconnect: vi.fn(),
      }}
      messages={{ players: [], teams: [], onSend: vi.fn() }}
    />
  )
}

async function seed(gqOverrides: Partial<GameQuestion> = {}) {
  await db.rounds.add(ROUND)
  await db.gameQuestions.bulkAdd([
    makeGameQuestion(gqOverrides),
    makeGameQuestion({ id: 'gq2', questionId: 'q2', order: 1 }),
  ])
}

beforeEach(async () => {
  vi.clearAllMocks()
  mockTimers.length = 0
  await Promise.all([db.rounds.clear(), db.gameQuestions.clear(), db.games.clear()])
})

// ── Confirm before leaving an unruled question ────────────────────────────────

describe('ActiveGame: confirm-before-navigate', () => {
  it('opens the confirm-skip modal on a pending question, and navigates once confirmed', async () => {
    const user = userEvent.setup()
    await seed()
    renderActiveGame(makeGame({ confirmUnruledNavigation: true }))

    const nextButton = await screen.findByRole('button', { name: 'Next question' })
    await user.click(nextButton)

    expect(screen.getByText('Move on without ruling?')).toBeInTheDocument()
    expect(mockSend).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SLIDE_CHANGE' }))

    const confirmButtons = screen.getAllByRole('button', { name: 'Next question' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    expect(screen.queryByText('Move on without ruling?')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'SLIDE_CHANGE' }))
    )
  })

  it('navigates immediately, with no modal, when confirmUnruledNavigation is off', async () => {
    const user = userEvent.setup()
    await seed()
    renderActiveGame(makeGame({ confirmUnruledNavigation: false }))

    const nextButton = await screen.findByRole('button', { name: 'Next question' })
    await user.click(nextButton)

    expect(screen.queryByText('Move on without ruling?')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'SLIDE_CHANGE' }))
    )
  })

  it('navigates immediately, with no modal, when the question already has a ruling', async () => {
    const user = userEvent.setup()
    await seed({ status: 'correct' })
    renderActiveGame(makeGame({ confirmUnruledNavigation: true }))

    const nextButton = await screen.findByRole('button', { name: 'Next question' })
    await user.click(nextButton)

    expect(screen.queryByText('Move on without ruling?')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'SLIDE_CHANGE' }))
    )
  })
})

// ── Auto-start timer on question show ─────────────────────────────────────────

describe('ActiveGame: auto-start timer', () => {
  it('auto-starts a timer with the configured duration when a question is shown', async () => {
    await seed()
    renderActiveGame(makeGame({ autoStartTimerOnQuestionShow: true, defaultTimerDuration: 45 }))

    await screen.findByRole('button', { name: 'Next question' })
    await waitFor(() => expect(mockCreateTimer).toHaveBeenCalledTimes(1))
    expect(mockCreateTimer).toHaveBeenCalledWith({
      gameId: 'g1',
      label: 'Question',
      duration: 45,
      autoReset: 'question',
    })
    await waitFor(() => expect(mockStartTimer).toHaveBeenCalledWith('timer-1'))
  })

  it('does not auto-start a second timer on an unrelated re-render of the same question', async () => {
    await seed()
    const { rerender } = renderActiveGame(
      makeGame({ autoStartTimerOnQuestionShow: true, defaultTimerDuration: 45 })
    )
    await screen.findByRole('button', { name: 'Next question' })
    await waitFor(() => expect(mockCreateTimer).toHaveBeenCalledTimes(1))

    rerender(
      <ActiveGame
        game={makeGame({ autoStartTimerOnQuestionShow: true, defaultTimerDuration: 45 })}
        onGameChange={vi.fn()}
        lifecycle={{ pauseGame: vi.fn(), resumeGame: vi.fn(), endGame: vi.fn() }}
        buzzHandlerRef={{ current: null }}
        pendingJoins={[]}
        onApproveJoin={vi.fn()}
        onRejectJoin={vi.fn()}
        players={[]}
        teams={[]}
        onKick={vi.fn()}
        onAddPlayer={vi.fn()}
        onAssignPlayer={vi.fn()}
        onAdjustScore={vi.fn()}
        onUpdatePlayerNotes={vi.fn()}
        onCreateTeam={vi.fn()}
        onQuestionContent={vi.fn()}
        onScreenContent={vi.fn()}
        screens={{
          roomId: 'ROOM1',
          pending: [],
          connected: [],
          onApprove: vi.fn(),
          onReject: vi.fn(),
          onDisconnect: vi.fn(),
        }}
        messages={{ players: [], teams: [], onSend: vi.fn() }}
      />
    )

    expect(mockCreateTimer).toHaveBeenCalledTimes(1)
  })

  it('does not auto-start a timer when the setting is off', async () => {
    await seed()
    renderActiveGame(makeGame({ autoStartTimerOnQuestionShow: false }))

    await screen.findByRole('button', { name: 'Next question' })
    expect(mockCreateTimer).not.toHaveBeenCalled()
    expect(mockStartTimer).not.toHaveBeenCalled()
  })

  it('reuses the auto-started timer on the next question instead of adding another', async () => {
    const user = userEvent.setup()
    await seed({ status: 'correct' })
    renderActiveGame(makeGame({ autoStartTimerOnQuestionShow: true, defaultTimerDuration: 45 }))
    await waitFor(() => expect(mockStartTimer).toHaveBeenCalledWith('timer-1'))

    await user.click(await screen.findByRole('button', { name: 'Next question' }))

    await waitFor(() => expect(mockRestartTimer).toHaveBeenCalledWith('timer-1'))
    expect(mockCreateTimer).toHaveBeenCalledTimes(1)
  })

  it('replaces the auto-started timer when the default duration changed', async () => {
    const user = userEvent.setup()
    await seed({ status: 'correct' })
    renderActiveGame(makeGame({ autoStartTimerOnQuestionShow: true, defaultTimerDuration: 45 }))
    await waitFor(() => expect(mockStartTimer).toHaveBeenCalledWith('timer-1'))
    // As if the timer was made before the game's default duration changed
    mockTimers[0].duration = 30

    await user.click(await screen.findByRole('button', { name: 'Next question' }))

    await waitFor(() => expect(mockCreateTimer).toHaveBeenCalledTimes(2))
    expect(mockDeleteTimer).toHaveBeenCalledWith('timer-1')
    expect(mockRestartTimer).not.toHaveBeenCalled()
    await waitFor(() => expect(mockStartTimer).toHaveBeenCalledWith('timer-2'))
  })
})

// ── Auto-advance ──────────────────────────────────────────────────────────────

describe('ActiveGame: auto-advance', () => {
  // A running question timer that runs out a moment after the page opens
  function expiringQuestionTimer(): Timer {
    return {
      id: 'q-timer',
      gameId: 'g1',
      label: 'Question',
      duration: 10,
      remaining: 10,
      target: 'all',
      message: '',
      visible: true,
      paused: false,
      startedAt: Date.now() - 9_900,
      audioNotify: 'none',
      visualNotify: 'none',
      autoReset: 'question',
    }
  }

  it('moves to the next question after the question timer runs out', async () => {
    await seed()
    mockTimers.push(expiringQuestionTimer())
    renderActiveGame(makeGame({ autoAdvanceOnTimerExpiry: true, autoAdvanceDelaySeconds: 1 }))

    expect(await screen.findByRole('status')).toHaveTextContent("Time's up. Next question in")
    await waitFor(
      () =>
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'SLIDE_CHANGE', index: 1 })
        ),
      { timeout: 3000 }
    )
  })

  it('stays on the question when the host presses Stay', async () => {
    const user = userEvent.setup()
    await seed()
    mockTimers.push(expiringQuestionTimer())
    renderActiveGame(makeGame({ autoAdvanceOnTimerExpiry: true, autoAdvanceDelaySeconds: 1 }))

    await user.click(await screen.findByRole('button', { name: 'Stay' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await new Promise(r => setTimeout(r, 1200))
    expect(mockSend).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SLIDE_CHANGE' }))
  })
})
