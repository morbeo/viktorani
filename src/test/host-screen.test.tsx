// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '@/db'
import type { Game, Question } from '@/db'
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
  allowIndividual: true,
  allowLateJoin: true,
  allowRejoin: true,
  requireApproval: false,
  allowPlayerTeams: true,
  roundIds: ['r1'],
  currentRoundIdx: 0,
  currentQuestionIdx: 0,
  buzzerLocked: false,
  scoringEnabled: true,
  buzzerEnabled: true,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly',
  tiebreakerMode: 'serverOrder',
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

function renderScreen(id = 'g1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/game/${id}/screen`]}>
      <Routes>
        <Route path="/admin/game/:id/screen" element={<Screen />} />
      </Routes>
    </MemoryRouter>
  )
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
  ])
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
    { id: 'gq1', gameId: 'g1', questionId: 'q1', roundId: 'r1', order: 0, status: 'pending' },
    { id: 'gq2', gameId: 'g1', questionId: 'q2', roundId: 'r1', order: 1, status: 'pending' },
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

  it('reports an unknown game', async () => {
    renderScreen('missing')
    expect(await screen.findByRole('alert')).toHaveTextContent('Game not found')
  })
})
