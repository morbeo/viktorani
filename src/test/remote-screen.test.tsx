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
import RemoteScreen from '@/pages/screen/RemoteScreen'
import { INITIAL_SCREEN, reduceScreen } from '@/pages/screen/screen-session'
import { ScreensPanel } from '@/components/gamemaster/ScreensPanel'

type QuestionContent = Extract<TransportEvent, { type: 'QUESTION_CONTENT' }>

const CONTENT: QuestionContent = {
  type: 'QUESTION_CONTENT',
  target: 'screen',
  questionId: 'q1',
  title: 'Capital of France?',
  description: null,
  options: ['Paris', 'Lyon'],
  answer: null,
  media: null,
  mediaType: null,
}

function emit(event: TransportEvent) {
  act(() => bus.handlers.forEach(h => h(event, 'host')))
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/screen/ABC234']}>
      <Routes>
        <Route path="/screen/:roomId" element={<RemoteScreen />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(transportManager.connect).mockResolvedValue(undefined)
})

describe('reduceScreen', () => {
  it('keeps the host message and clears it', () => {
    const s = reduceScreen(INITIAL_SCREEN, { type: 'MESSAGE', text: 'Break: 10 minutes' })
    expect(s.message).toBe('Break: 10 minutes')
    expect(reduceScreen(s, { type: 'MESSAGE', text: null }).message).toBeNull()
  })

  it('follows GAME_STATUS', () => {
    const s = reduceScreen(INITIAL_SCREEN, { type: 'GAME_STATUS', status: 'paused' })
    expect(s.gameStatus).toBe('paused')
  })

  it('keeps screen content only and clears it on navigation', () => {
    const players = { ...CONTENT, target: 'players' as const }
    expect(reduceScreen(INITIAL_SCREEN, players)).toBe(INITIAL_SCREEN)
    const shown = reduceScreen(INITIAL_SCREEN, CONTENT)
    expect(shown.content).toEqual(CONTENT)
    expect(reduceScreen(shown, { type: 'SLIDE_CHANGE', index: 1, roundIndex: 0 }).content).toBe(
      null
    )
  })

  it('drops unsafe media', () => {
    const unsafe = { ...CONTENT, media: 'javascript:alert(1)', mediaType: 'image' as const }
    const { content } = reduceScreen(INITIAL_SCREEN, unsafe)
    expect(content?.media).toBeNull()
    expect(content?.mediaType).toBeNull()
  })

  it('keeps the latest LOG feed', () => {
    const entries = [{ id: 'e1', at: 1, kind: 'buzz' as const, who: 'Ann', details: '' }]
    const s = reduceScreen(INITIAL_SCREEN, { type: 'LOG', entries })
    expect(s.logEntries).toEqual(entries)
  })
})

describe('RemoteScreen', () => {
  it('joins as a screen and waits for approval', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalledWith({ type: 'SCREEN_JOIN' }))
    expect(transportManager.connect).toHaveBeenCalledWith({ role: 'player', roomId: 'ABC234' })
    emit({ type: 'JOIN_PENDING' })
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the host to approve')
  })

  it('shows the question and scoreboard once approved', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'SCREEN_ACCEPTED' })
    emit(CONTENT)
    emit({ type: 'SCOREBOARD', rows: [{ id: 'p1', name: 'Ann', score: 7 }] })
    expect(screen.getByRole('heading', { name: 'Capital of France?' })).toBeInTheDocument()
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('Ann')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('shows the public log feed once approved', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'SCREEN_ACCEPTED' })
    emit({
      type: 'LOG',
      entries: [{ id: 'e1', at: 1, kind: 'player_kicked', who: 'Bob', details: '' }],
    })
    expect(screen.getByText('Kicked').closest('li')).toHaveTextContent('Kicked · Bob')
  })

  it('shows the rejection reason', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'JOIN_REJECTED', reason: 'The host declined the screen' })
    expect(screen.getByRole('alert')).toHaveTextContent('The host declined the screen')
  })

  it('says when the host pauses the game', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'SCREEN_ACCEPTED' })
    emit({ type: 'GAME_STATUS', status: 'paused' })
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('keeps the final scoreboard up once the game ends', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'SCREEN_ACCEPTED' })
    emit({ type: 'SCOREBOARD', rows: [{ id: 'p1', name: 'Ann', score: 7 }] })
    emit({ type: 'GAME_STATUS', status: 'ended' })
    act(() => bus.closeHandlers.forEach(h => h('host')))
    expect(screen.getByText('Game over')).toBeInTheDocument()
    expect(screen.getByText('Ann')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(transportManager.connect).toHaveBeenCalledTimes(1)
  })

  it('joins again on its own when the host connection drops', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'SCREEN_ACCEPTED' })
    act(() => bus.closeHandlers.forEach(h => h('host')))
    await waitFor(() => expect(transportManager.send).toHaveBeenCalledTimes(2))
    expect(transportManager.connect).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('Connecting to the host…')
  })

  it('offers to reconnect, with the reason, once the retries fail', async () => {
    vi.mocked(transportManager.connect).mockRejectedValue(new Error('network'))
    renderScreen()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lost the connection to the host. Cannot reach the connection server.'
    )
    expect(transportManager.connect).toHaveBeenCalledTimes(2)

    vi.mocked(transportManager.connect).mockResolvedValue(undefined)
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect(transportManager.send).toHaveBeenCalledWith({ type: 'SCREEN_JOIN' }))
  })
})

describe('ScreensPanel', () => {
  it('lists waiting screens with approve and reject', async () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(
      <ScreensPanel
        roomId="ABC234"
        pending={['c1', 'c2']}
        connected={[]}
        onApprove={onApprove}
        onReject={onReject}
        onDisconnect={vi.fn()}
      />
    )
    expect(screen.getByTitle(/#\/screen\/ABC234$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Approve screen 2' }))
    expect(onApprove).toHaveBeenCalledWith('c2')
    await userEvent.click(screen.getByRole('button', { name: 'Reject screen 1' }))
    expect(onReject).toHaveBeenCalledWith('c1')
  })

  it('lists connected screens with a disconnect action', async () => {
    const onDisconnect = vi.fn()
    render(
      <ScreensPanel
        roomId="ABC234"
        pending={[]}
        connected={['c1', 'c2']}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDisconnect={onDisconnect}
      />
    )
    expect(screen.getByText('Screen 1')).toBeInTheDocument()
    expect(screen.getByText('Screen 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect screen 2' }))
    expect(onDisconnect).toHaveBeenCalledWith('c2')
  })
})
