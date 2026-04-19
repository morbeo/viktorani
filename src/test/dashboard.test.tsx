// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'
import { db } from '@/db'
import type { Game } from '@/db'
import Dashboard from '@/pages/admin/Dashboard'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={['/admin']}>{children}</MemoryRouter>
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    transportMode: 'auto',
    roomId: null,
    passphrase: null,
    showQuestion: true,
    showAnswers: false,
    showMedia: true,
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    scoringEnabled: true,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

async function clearAll() {
  await Promise.all([
    db.questions.clear(),
    db.rounds.clear(),
    db.games.clear(),
    db.managedPlayers.clear(),
    db.managedTeams.clear(),
  ])
}

describe('Dashboard', () => {
  beforeEach(clearAll)

  it('renders three tile headings on empty db', async () => {
    render(<Dashboard />, { wrapper: Wrapper })
    expect(await screen.findByText('Questions')).toBeInTheDocument()
    expect(screen.getByText('Games')).toBeInTheDocument()
    expect(screen.getByText('Players & Teams')).toBeInTheDocument()
  })

  it('shows correct question count and round sub-label', async () => {
    await act(async () => {
      await db.rounds.bulkAdd([
        { id: 'r1', title: 'R1', order: 0, createdAt: Date.now() },
        { id: 'r2', title: 'R2', order: 1, createdAt: Date.now() },
      ])
      await db.questions.bulkAdd([
        {
          id: 'q1', title: 'Q1', type: 'open_ended', options: [], answer: 'A',
          description: '', difficulty: null, tags: [], media: null, mediaType: null,
          createdAt: Date.now(), updatedAt: Date.now(),
        },
        {
          id: 'q2', title: 'Q2', type: 'open_ended', options: [], answer: 'B',
          description: '', difficulty: null, tags: [], media: null, mediaType: null,
          createdAt: Date.now(), updatedAt: Date.now(),
        },
      ])
    })
    render(<Dashboard />, { wrapper: Wrapper })
    expect(await screen.findByText('across 2 rounds')).toBeInTheDocument()
  })

  it('shows active badge and Resume footer when a game is active', async () => {
    await act(async () => {
      await db.games.add(makeGame({ status: 'active' }))
    })
    render(<Dashboard />, { wrapper: Wrapper })
    expect(await screen.findByText('1 active')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
  })

  it('shows New game and All games footer when no active game', async () => {
    render(<Dashboard />, { wrapper: Wrapper })
    expect(await screen.findByText('New game')).toBeInTheDocument()
    expect(screen.getByText('All games')).toBeInTheDocument()
  })

  it('shows player count and team sub-label', async () => {
    await act(async () => {
      await db.managedTeams.bulkAdd([
        { id: 't1', name: 'Alpha', color: '#f00', icon: 'Zap', labelIds: [], playerIds: [], archivedAt: null, totalScore: 0, gameLog: [] },
        { id: 't2', name: 'Beta',  color: '#0f0', icon: 'Zap', labelIds: [], playerIds: [], archivedAt: null, totalScore: 0, gameLog: [] },
      ])
      await db.managedPlayers.add({
        id: 'p1', name: 'Alice', teamIds: ['t1'], labelIds: [],
        archivedAt: null, totalScore: 0, gameLog: [],
      })
    })
    render(<Dashboard />, { wrapper: Wrapper })
    await waitFor(() => expect(screen.getByText('2 teams')).toBeInTheDocument())
  })

  it('does not render the active game banner', async () => {
    await act(async () => {
      await db.games.add(makeGame({ status: 'active' }))
    })
    render(<Dashboard />, { wrapper: Wrapper })
    await screen.findByText('Games')
    expect(screen.queryByText(/currently active/i)).not.toBeInTheDocument()
  })

  it('does not render a Notes tile', async () => {
    render(<Dashboard />, { wrapper: Wrapper })
    await screen.findByText('Questions')
    expect(screen.queryByText(/^Notes$/)).not.toBeInTheDocument()
  })
})
