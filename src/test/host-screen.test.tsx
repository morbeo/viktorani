// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '@/db'
import type { Game, GamePhase, Question } from '@/db'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import { writePhaseOverride } from '@/lib/layout-phase'
import Screen from '@/pages/admin/Screen'

vi.mock('@/transport', () => ({ transportManager: { send: vi.fn() } }))

const VISIBLE = { showQuestion: true, showAnswers: true, showMedia: true }

const GAME: Game = {
  id: 'g1',
  name: 'Quiz night',
  status: 'active',
  roomId: null,
  visibility: { players: VISIBLE, screen: VISIBLE },
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
  scoreboardBetweenRounds: false,
  allowPlayerTeams: true,
  roundIds: ['r1'],
  currentRoundIdx: 0,
  currentQuestionIdx: 0,
  buzzerLocked: false,
  scoringEnabled: true,
  inputType: 'buzzer',
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
  createdAt: 0,
  updatedAt: 0,
}

function question(id: string, title: string): Question {
  return {
    id,
    title,
    type: 'multiple_choice',
    options: ['Paris', 'Lyon'],
    answer: 'Paris',
    description: '',
    difficulty: null,
    tags: [],
    media: null,
    mediaType: null,
    createdAt: 0,
    updatedAt: 0,
  }
}

function renderScreen(id = 'g1', surface: 'screen' | 'scoreboard' = 'screen') {
  return render(
    <MemoryRouter initialEntries={[`/admin/game/${id}/${surface}`]}>
      <Routes>
        <Route path="/admin/game/:id/screen" element={<Screen />} />
        <Route path="/admin/game/:id/scoreboard" element={<Screen surface="scoreboard" />} />
      </Routes>
    </MemoryRouter>
  )
}

const ALICE = {
  id: 'p1',
  gameId: 'g1',
  name: 'Alice',
  teamId: null,
  score: 7,
  presence: 'connected' as const,
  disconnectedAt: null,
  deviceId: 'd1',
  joinedAt: 0,
  notes: '',
}

const BUZZ = {
  id: 'b1',
  gameId: 'g1',
  questionId: 'q1',
  playerId: 'p1',
  playerName: 'Alice',
  teamId: null,
  timestamp: 1,
  receivedAt: 1,
  isFalseStart: false,
  gmDecision: null,
  decidedAt: null,
}

beforeEach(async () => {
  await Promise.all([
    db.games.clear(),
    db.rounds.clear(),
    db.questions.clear(),
    db.gameQuestions.clear(),
    db.timers.clear(),
    db.players.clear(),
    db.teams.clear(),
    db.layouts.clear(),
    db.widgets.clear(),
    db.buzzEvents.clear(),
    db.scoreEvents.clear(),
    db.gameLog.clear(),
  ])
  localStorage.clear()
  await db.games.add(GAME)
  await db.rounds.add({
    id: 'r1',
    name: 'Geography',
    description: '',
    questionIds: [],
    createdAt: 0,
  })
  await db.questions.bulkAdd([
    question('q1', 'Capital of France?'),
    question('q2', 'Longest river?'),
  ])
  await db.gameQuestions.bulkAdd([
    {
      id: 'gq1',
      gameId: 'g1',
      questionId: 'q1',
      roundId: 'r1',
      order: 0,
      status: 'pending',
      revealed: false,
    },
    {
      id: 'gq2',
      gameId: 'g1',
      questionId: 'q2',
      roundId: 'r1',
      order: 1,
      status: 'pending',
      revealed: false,
    },
  ])
})

describe('Screen', () => {
  it('shows the current question with its options but never the answer', async () => {
    renderScreen()
    expect(await screen.findByRole('heading', { name: 'Capital of France?' })).toBeInTheDocument()
    expect(screen.getByText('Geography · Question 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('Lyon')).toBeInTheDocument()
    // 'Paris' appears once, as an option, not again as a revealed answer
    expect(screen.getAllByText('Paris')).toHaveLength(1)
  })

  it('follows the GM as they navigate and toggle screen visibility', async () => {
    renderScreen()
    await screen.findByRole('heading', { name: 'Capital of France?' })

    await db.games.update('g1', { currentQuestionIdx: 1 })
    expect(await screen.findByRole('heading', { name: 'Longest river?' })).toBeInTheDocument()

    await db.games.update('g1', {
      visibility: { players: VISIBLE, screen: { ...VISIBLE, showQuestion: false } },
    })
    await waitFor(() => expect(screen.queryByRole('heading')).toBeNull())
    expect(screen.getByText('Geography · Question 2 of 2')).toBeInTheDocument()
  })

  it('shows started timers and the scoreboard', async () => {
    await db.timers.add({
      id: 't1',
      gameId: 'g1',
      label: 'Answer time',
      duration: 60,
      remaining: 30,
      target: 'all',
      message: '',
      visible: true,
      paused: true,
      startedAt: null,
      audioNotify: 'none',
      visualNotify: 'none',
      autoReset: 'none',
    })
    await db.players.add({
      id: 'p1',
      gameId: 'g1',
      name: 'Alice',
      teamId: null,
      score: 7,
      presence: 'connected',
      disconnectedAt: null,
      deviceId: 'd1',
      joinedAt: 0,
      notes: '',
    })
    renderScreen()
    expect(await screen.findByText('Answer time')).toBeInTheDocument()
    expect(screen.getByText('00:30')).toBeInTheDocument()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('keeps held scores at the last announcement', async () => {
    await db.games.update('g1', { holdScores: true, scoresAnnouncedAt: 100 })
    await db.players.add({
      id: 'p1',
      gameId: 'g1',
      name: 'Alice',
      teamId: null,
      score: 7,
      presence: 'connected',
      disconnectedAt: null,
      deviceId: 'd1',
      joinedAt: 0,
      notes: '',
    })
    await db.scoreEvents.bulkAdd([
      {
        id: 'e1',
        gameId: 'g1',
        targetId: 'p1',
        kind: 'player',
        name: 'Alice',
        from: 0,
        to: 4,
        reason: 'step',
        questionId: null,
        timestamp: 50,
      },
      {
        id: 'e2',
        gameId: 'g1',
        targetId: 'p1',
        kind: 'player',
        name: 'Alice',
        from: 4,
        to: 7,
        reason: 'correct',
        questionId: 'q1',
        timestamp: 200,
      },
    ])
    renderScreen()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(await screen.findByText('4')).toBeInTheDocument()
    expect(screen.queryByText('7')).not.toBeInTheDocument()

    await act(() => db.games.update('g1', { scoresAnnouncedAt: 300 }))
    expect(await screen.findByText('7')).toBeInTheDocument()
  })

  it('reports an unknown game', async () => {
    renderScreen('missing')
    expect(await screen.findByRole('alert')).toHaveTextContent('Game not found')
  })

  it("uses the game's stored layouts for the phase, and the GM's override", async () => {
    const stored = (id: string, phase: GamePhase | null) => ({
      id,
      gameId: 'g1',
      name: id,
      target: 'screen' as const,
      phase,
      theme: { ...DEFAULT_LAYOUT_THEME },
      isActive: true,
      order: 0,
    })
    await db.layouts.bulkAdd([
      stored('all', null),
      stored('buzzed', 'buzzed'),
      stored('board', 'scoreboard'),
    ])
    await db.widgets.bulkAdd(
      ['all', 'buzzed', 'board'].map(layoutId => ({
        id: `${layoutId}-w`,
        layoutId,
        type: 'question' as const,
        config: {},
        grid: { x: 0, y: 0, w: 12, h: 1 },
        breakpoints: {},
        order: 0,
      }))
    )
    const layoutId = () =>
      document.querySelector('[data-layout-id]')?.getAttribute('data-layout-id')
    renderScreen()
    await waitFor(() => expect(layoutId()).toBe('all'))

    await db.buzzEvents.add({
      id: 'b1',
      gameId: 'g1',
      questionId: 'q1',
      playerId: 'p1',
      playerName: 'Ann',
      teamId: null,
      timestamp: 1,
      receivedAt: 1,
      isFalseStart: false,
      gmDecision: null,
      decidedAt: null,
    })
    await waitFor(() => expect(layoutId()).toBe('buzzed'))

    act(() => writePhaseOverride('g1', 'scoreboard'))
    await waitFor(() => expect(layoutId()).toBe('board'))
  })
})

describe('Scoreboard window (#502)', () => {
  it('shows the leaderboard, not the question', async () => {
    await db.players.bulkAdd([ALICE, { ...ALICE, id: 'p2', name: 'Bob', score: 3 }])
    renderScreen('g1', 'scoreboard')

    const board = await screen.findByRole('region', { name: 'Leaderboard' })
    expect(board).toHaveTextContent(/1\s*Alice\s*7/)
    expect(board).toHaveTextContent(/2\s*Bob\s*3/)
    expect(screen.queryByRole('heading', { name: 'Capital of France?' })).toBeNull()
    expect(document.querySelector('[data-widget="leaderboard"]')).not.toBeNull()
  })

  it("uses the game's scoreboard layout, with the public game log", async () => {
    await db.players.add(ALICE)
    await db.buzzEvents.add(BUZZ)
    await db.layouts.add({
      id: 'sb',
      gameId: 'g1',
      name: 'Pub board',
      target: 'scoreboard',
      phase: null,
      theme: { ...DEFAULT_LAYOUT_THEME },
      isActive: true,
      order: 0,
    })
    await db.widgets.add({
      id: 'sb-log',
      layoutId: 'sb',
      type: 'game_log',
      config: {},
      grid: { x: 0, y: 0, w: 12, h: 1 },
      breakpoints: {},
      order: 0,
    })
    renderScreen('g1', 'scoreboard')

    await waitFor(() =>
      expect(document.querySelector('[data-layout-id]')?.getAttribute('data-layout-id')).toBe('sb')
    )
    expect(await screen.findByText(/Alice/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Leaderboard' })).toBeNull()
  })

  it('leaves scores out when scoring is off', async () => {
    await db.games.update('g1', { scoringEnabled: false })
    await db.players.add(ALICE)
    renderScreen('g1', 'scoreboard')
    await waitFor(() => expect(document.querySelector('[data-layout-id]')).not.toBeNull())
    expect(screen.queryByText('Alice')).toBeNull()
  })
})

describe('Screen game log', () => {
  it('shows the public game log like remote screens', async () => {
    await db.players.add(ALICE)
    await db.buzzEvents.add(BUZZ)
    renderScreen()
    expect(await screen.findByText(/· Alice/)).toBeInTheDocument()
  })
})
