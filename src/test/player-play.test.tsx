// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { TransportEvent } from '@/transport/types'

const bus = vi.hoisted(() => ({
  handlers: [] as Array<(e: TransportEvent, from: string) => void>,
  closeHandlers: [] as Array<(id: string) => void>,
}))

vi.mock('@/transport', async importOriginal => {
  const actual = await importOriginal<typeof import('@/transport')>()
  return {
    ...actual,
    // One immediate retry keeps the tests fast
    retry: ((attempt, options) =>
      actual.retry(attempt, { ...options, delays: [0] })) as typeof actual.retry,
    transportManager: {
      error: 'Cannot reach the connection server.',
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      onEvent: vi.fn((h: (e: TransportEvent, from: string) => void) => {
        bus.handlers.push(h)
        return () => bus.handlers.splice(bus.handlers.indexOf(h), 1)
      }),
      onPeerClose: vi.fn((h: (id: string) => void) => {
        bus.closeHandlers.push(h)
        return () => bus.closeHandlers.splice(bus.closeHandlers.indexOf(h), 1)
      }),
    },
  }
})

import { transportManager } from '@/transport'
import Play from '@/pages/player/Play'
import { startPlayerSession } from '@/pages/player/player-session'

const STATE: TransportEvent = {
  type: 'GAME_STATE',
  state: {
    gameId: 'g1',
    status: 'active',
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerEnabled: true,
    buzzerLocked: false,
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    scores: { p1: 4, t1: 10 },
  },
}

function emit(event: TransportEvent) {
  act(() => bus.handlers.forEach(h => h(event, 'host')))
}

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/play/ABC234']}>
      <Routes>
        <Route path="/play/:roomId" element={<Play />} />
        <Route path="/join/:roomId" element={<p>Join screen</p>} />
      </Routes>
    </MemoryRouter>
  )
}

/** Reload the play screen and let the host accept the rejoin. */
async function reachGame() {
  renderPlay()
  await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
  emit({ type: 'JOIN_ACCEPTED', playerId: 'p1', teamId: 't1' })
  emit(STATE)
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('viktorani-player-name', JSON.stringify('Alice'))
  // Keeps the session's own transport listener, which is registered once per module
  startPlayerSession()
  vi.clearAllMocks()
  vi.mocked(transportManager.connect).mockResolvedValue(undefined)
})

describe('Play', () => {
  it('reconnects after a reload and asks the host to restore the player', async () => {
    renderPlay()
    expect(screen.getByRole('status')).toHaveTextContent('Connecting to the host…')
    await waitFor(() => expect(transportManager.send).toHaveBeenCalledTimes(1))
    expect(transportManager.connect).toHaveBeenCalledWith({ role: 'player', roomId: 'ABC234' })
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'JOIN', playerName: 'Alice', teamId: null })
    )
  })

  it('shows the scores and buzzes once while the buzzer is open', async () => {
    await reachGame()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Buzz' }))
    expect(transportManager.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'BUZZ' })
    )
    expect(screen.getByRole('button', { name: 'Buzz' })).toHaveTextContent('Buzzed!')
    expect(screen.getByRole('button', { name: 'Buzz' })).toBeDisabled()

    emit({ type: 'BUZZER_LOCK' })
    emit({ type: 'BUZZER_UNLOCK' })
    expect(screen.getByRole('button', { name: 'Buzz' })).toBeEnabled()
  })

  it('hides the buzz button when the game has no buzzer', async () => {
    renderPlay()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'JOIN_ACCEPTED', playerId: 'p1', teamId: 't1' })
    emit({ ...STATE, state: { ...STATE.state, buzzerEnabled: false } })
    expect(screen.queryByRole('button', { name: 'Buzz' })).toBeNull()
  })

  it('shows the question the host sends and clears it on the next slide', async () => {
    await reachGame()
    emit({
      type: 'QUESTION_CONTENT',
      target: 'players',
      questionId: 'q1',
      title: 'Capital of France?',
      description: null,
      options: ['Paris', 'Lyon'],
      answer: null,
      media: null,
      mediaType: null,
    })
    expect(screen.getByRole('heading', { name: 'Capital of France?' })).toBeInTheDocument()
    expect(screen.getByText('Paris')).toBeInTheDocument()

    emit({ type: 'SLIDE_CHANGE', index: 1, roundIndex: 0 })
    expect(screen.queryByRole('region', { name: 'Question' })).toBeNull()
  })

  it('disables the buzz button while the host keeps the buzzer locked', async () => {
    await reachGame()
    emit({ type: 'BUZZER_LOCK' })
    expect(screen.getByRole('button', { name: 'Buzz' })).toHaveTextContent('Locked')
    expect(screen.getByRole('button', { name: 'Buzz' })).toBeDisabled()
  })

  it('reports tab switches to the host', async () => {
    await reachGame()
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(transportManager.send).toHaveBeenLastCalledWith({ type: 'FOCUS_CHANGE', away: true })
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  it('leaves the game and returns to the join screen', async () => {
    await reachGame()
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(transportManager.send).toHaveBeenLastCalledWith({ type: 'LEAVE' })
    expect(transportManager.disconnect).toHaveBeenCalled()
    expect(screen.getByText('Join screen')).toBeInTheDocument()
  })

  it('sends a player without a saved name to the join screen', () => {
    localStorage.clear()
    renderPlay()
    expect(screen.getByText('Join screen')).toBeInTheDocument()
    expect(transportManager.connect).not.toHaveBeenCalled()
  })

  it('explains a rejected rejoin', async () => {
    renderPlay()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'JOIN_REJECTED', reason: 'Rejoining is not allowed' })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You could not rejoin: Rejoining is not allowed'
    )
  })

  it('rejoins on its own when the host connection drops', async () => {
    await reachGame()
    act(() => bus.closeHandlers.forEach(h => h('host')))
    await waitFor(() => expect(transportManager.connect).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(transportManager.send).toHaveBeenCalledTimes(2))
    expect(transportManager.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'JOIN', playerName: 'Alice' })
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers to reconnect, with the reason, once the retries fail', async () => {
    await reachGame()
    vi.mocked(transportManager.connect).mockRejectedValue(new Error('network'))
    act(() => bus.closeHandlers.forEach(h => h('host')))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lost the connection to the host. Cannot reach the connection server.'
    )
    // The first try and one retry
    expect(transportManager.connect).toHaveBeenCalledTimes(3)

    vi.mocked(transportManager.connect).mockResolvedValue(undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect(transportManager.connect).toHaveBeenCalledTimes(4))
  })

  it('holds the buzzer while the host pauses the game', async () => {
    await reachGame()
    emit({ type: 'GAME_STATUS', status: 'paused' })
    expect(screen.getByRole('status')).toHaveTextContent('The host paused the game.')
    expect(screen.getByRole('button', { name: 'Buzz' })).toHaveTextContent('Paused')
    expect(screen.getByRole('button', { name: 'Buzz' })).toBeDisabled()

    emit({ type: 'GAME_STATUS', status: 'active' })
    expect(screen.getByRole('button', { name: 'Buzz' })).toBeEnabled()
  })

  it('shows the final score instead of a lost connection once the game ends', async () => {
    await reachGame()
    emit({ type: 'GAME_STATUS', status: 'ended' })
    act(() => bus.closeHandlers.forEach(h => h('host')))
    expect(screen.getByRole('status')).toHaveTextContent('The game has ended')
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Buzz' })).toBeNull()
    expect(transportManager.connect).toHaveBeenCalledTimes(1)
  })

  it('shows the host message until dismissed, and a repeat of it again', async () => {
    await reachGame()
    emit({ type: 'MESSAGE', text: 'Two minutes to the next round' })
    expect(screen.getByText('Two minutes to the next round')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByText('Two minutes to the next round')).toBeNull()

    emit({ type: 'MESSAGE', text: 'Two minutes to the next round' })
    expect(screen.getByText('Two minutes to the next round')).toBeInTheDocument()
    emit({ type: 'MESSAGE', text: null })
    expect(screen.queryByText('Two minutes to the next round')).toBeNull()
  })
})
