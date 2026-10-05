// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'
import { db } from '@/db'
import type { Game, Player } from '@/db'
import AdminLayout from '@/components/AdminLayout'

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Quiz night',
    status: 'active',
    roomId: 'ABCDEF',
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
    requireApproval: false,
    allowPlayerTeams: true,
    roundIds: [],
    currentRoundIdx: 1,
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
    ...overrides,
  }
}

function makePlayer(id: string, gameId = 'g1'): Player {
  return {
    id,
    gameId,
    name: id,
    teamId: null,
    score: 0,
    presence: 'connected',
    deviceId: `device-${id}`,
    joinedAt: 0,
    notes: '',
  }
}

function renderLayout() {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminLayout>content</AdminLayout>
    </MemoryRouter>
  )
}

const gamesLink = () => screen.getByRole('link', { name: /^Games/ })

describe('Live game indicator', () => {
  beforeEach(async () => {
    await Promise.all([db.games.clear(), db.players.clear()])
  })

  it('shows nothing when no game is running', async () => {
    await db.games.add(makeGame({ status: 'waiting' }))
    renderLayout()
    await waitFor(() => expect(gamesLink()).toHaveAccessibleName('Games'))
    expect(screen.queryByRole('link', { name: /is live|is paused/ })).not.toBeInTheDocument()
  })

  it('marks an active game and opens its host page', async () => {
    await db.games.add(makeGame())
    await db.players.bulkAdd([makePlayer('p1'), makePlayer('p2'), makePlayer('p3', 'other')])
    renderLayout()
    const marker = await screen.findByRole('link', {
      name: 'Quiz night is live: 2 players, round 2',
    })
    expect(marker).toHaveAttribute('href', '/admin/game/g1')
    expect(marker).toHaveAttribute('data-status', 'active')
    expect(gamesLink()).toHaveAccessibleName('Games, 1 game live')
  })

  it('shows a paused game differently', async () => {
    await db.games.add(makeGame({ status: 'paused' }))
    renderLayout()
    const marker = await screen.findByRole('link', {
      name: 'Quiz night is paused: 0 players, round 2',
    })
    expect(marker).toHaveAttribute('data-status', 'paused')
    expect(gamesLink()).toHaveAccessibleName('Games, 1 game paused')
  })

  it('opens the Games list when several games are running', async () => {
    await db.games.bulkAdd([
      makeGame(),
      makeGame({ id: 'g2', name: 'Pub quiz', status: 'paused', createdAt: 1 }),
    ])
    renderLayout()
    const marker = await screen.findByRole('link', { name: /^2 games running/ })
    expect(marker).toHaveAttribute('href', '/admin/games')
    expect(gamesLink()).toHaveAccessibleName('Games, 1 game live, 1 paused')
  })

  it('updates when a game ends, without a reload', async () => {
    await db.games.add(makeGame())
    renderLayout()
    await screen.findByRole('link', { name: /Quiz night is live/ })
    await act(async () => {
      await db.games.update('g1', { status: 'ended' })
    })
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Quiz night is live/ })).not.toBeInTheDocument()
    )
    expect(gamesLink()).toHaveAccessibleName('Games')
  })
})
