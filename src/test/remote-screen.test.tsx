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
import { BUILT_IN_THEMES, resolveTheme } from '@/lib/theme'

type QuestionContent = Extract<TransportEvent, { type: 'QUESTION_CONTENT' }>

const CONTENT: QuestionContent = {
  type: 'QUESTION_CONTENT',
  target: 'screen',
  questionId: 'q1',
  title: 'Capital of France?',
  description: null,
  options: ['Paris', 'Lyon'],
  answer: null,
  choices: null,
  acceptsText: false,
  media: null,
  mediaType: null,
}

function emit(event: TransportEvent) {
  act(() => bus.handlers.forEach(h => h(event, 'host')))
}

function renderScreen(path = '/screen/ABC234') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/screen/:roomId" element={<RemoteScreen />} />
        <Route path="/watch/:roomId" element={<RemoteScreen watch />} />
        <Route path="/scoreboard/:roomId" element={<RemoteScreen surface="scoreboard" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(transportManager.connect).mockResolvedValue(undefined)
})

describe('reduceScreen', () => {
  it("keeps the screen's round answers only", () => {
    const review = { roundName: 'R1', view: 'table' as const, items: [] }
    const s = reduceScreen(INITIAL_SCREEN, { type: 'ROUND_ANSWERS', target: 'screen', review })
    expect(s.roundAnswers).toEqual(review)
    expect(reduceScreen(INITIAL_SCREEN, { type: 'ROUND_ANSWERS', target: 'players', review })).toBe(
      INITIAL_SCREEN
    )
  })

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

  it('keeps the latest LAYOUT for screens and ignores the players one', () => {
    const event = {
      type: 'LAYOUT' as const,
      target: 'screen' as const,
      gameId: 'g1',
      layouts: [],
      assignments: {},
    }
    const s = reduceScreen(INITIAL_SCREEN, event)
    expect(s.layouts).toEqual({ gameId: 'g1', layouts: [], assignments: {} })
    expect(reduceScreen(s, { ...event, target: 'player' })).toBe(s)
  })

  it('keeps the scoreboard LAYOUT on a scoreboard display and ignores the screen one', () => {
    const event = {
      type: 'LAYOUT' as const,
      target: 'scoreboard' as const,
      gameId: 'g1',
      layouts: [],
      assignments: {},
    }
    expect(reduceScreen(INITIAL_SCREEN, event)).toBe(INITIAL_SCREEN)
    const s = reduceScreen(INITIAL_SCREEN, event, 'scoreboard')
    expect(s.layouts).toEqual({ gameId: 'g1', layouts: [], assignments: {} })
    expect(reduceScreen(s, { ...event, target: 'screen' }, 'scoreboard')).toBe(s)
  })

  it('keeps the latest PHASE', () => {
    expect(reduceScreen(INITIAL_SCREEN, { type: 'PHASE', phase: 'reveal' }).phase).toBe('reveal')
  })

  it('keeps the latest THEME', () => {
    const theme = resolveTheme({ app: BUILT_IN_THEMES[2], surface: 'screen' })
    expect(reduceScreen(INITIAL_SCREEN, { type: 'THEME', theme }).theme).toBe(theme)
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

  it('joins as a spectator to watch, and says when the game takes none', async () => {
    renderScreen('/watch/ABC234')
    await waitFor(() =>
      expect(transportManager.send).toHaveBeenCalledWith({ type: 'SCREEN_JOIN', watch: true })
    )
    emit({ type: 'JOIN_REJECTED', reason: "This game isn't taking spectators." })
    expect(screen.getByRole('alert')).toHaveTextContent(
      "You can't watch this game: This game isn't taking spectators."
    )
  })

  it('joins as a scoreboard display, then shows the scores and log but not the question', async () => {
    renderScreen('/scoreboard/ABC234')
    await waitFor(() =>
      expect(transportManager.send).toHaveBeenCalledWith({
        type: 'SCREEN_JOIN',
        surface: 'scoreboard',
      })
    )
    emit({ type: 'JOIN_PENDING' })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Waiting for the host to approve this scoreboard'
    )
    emit({ type: 'SCREEN_ACCEPTED' })
    emit(CONTENT)
    emit({ type: 'SCOREBOARD', rows: [{ id: 'p1', name: 'Ann', score: 7, place: 1 }] })
    expect(screen.getByText('Ann')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Capital of France?' })).toBeNull()
  })

  it("shows the host's scoreboard layout on a scoreboard display", async () => {
    renderScreen('/scoreboard/ABC234')
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'SCREEN_ACCEPTED' })
    const bundle = (id: string, target: 'screen' | 'scoreboard') => ({
      layout: {
        id,
        gameId: 'g1',
        name: id,
        target,
        phase: null,
        theme: { background: null, accent: '#00966e', fontScale: 1, logo: null },
        isActive: true,
        order: 0,
      },
      widgets: [],
    })
    emit({
      type: 'LAYOUT',
      target: 'screen',
      gameId: 'g1',
      layouts: [bundle('tv', 'screen')],
      assignments: {},
    })
    emit({
      type: 'LAYOUT',
      target: 'scoreboard',
      gameId: 'g1',
      layouts: [bundle('board', 'scoreboard')],
      assignments: {},
    })
    expect(document.querySelector('[data-layout-id="board"]')).not.toBeNull()
    expect(document.querySelector('[data-layout-id="tv"]')).toBeNull()
  })

  it('shows the question and scoreboard once approved', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'SCREEN_ACCEPTED' })
    emit(CONTENT)
    emit({ type: 'SCOREBOARD', rows: [{ id: 'p1', name: 'Ann', score: 7, place: 1 }] })
    expect(screen.getByRole('heading', { name: 'Capital of France?' })).toBeInTheDocument()
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('Ann')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it("shows the host's screen layout, its ended layout once the game ends, and skips broken ones", async () => {
    const layout = (
      id: string,
      phase: 'ended' | null,
      type: 'question' | 'scoreboard' | 'buzzer'
    ) => ({
      layout: {
        id,
        gameId: 'g1',
        name: id,
        target: 'screen' as const,
        phase,
        theme: { background: null, accent: null, fontScale: 1, logo: null },
        isActive: true,
        order: 0,
      },
      widgets: [
        {
          id: `${id}-w`,
          layoutId: id,
          type,
          config: {},
          grid: { x: 0, y: 0, w: 12, h: 1 },
          breakpoints: {},
          order: 0,
        },
      ],
    })
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'SCREEN_ACCEPTED' })
    emit({
      type: 'LAYOUT',
      target: 'screen',
      gameId: 'g1',
      assignments: {},
      // The buzzer has no screen component, so that layout can't render and is skipped
      layouts: [
        layout('broken', null, 'buzzer'),
        layout('tv', null, 'question'),
        layout('end', 'ended', 'scoreboard'),
      ],
    })
    expect(document.querySelector('[data-layout-id="tv"]')).not.toBeNull()
    // The host's phase picks the layout; scoreboard has none of its own, so the all-phase one
    emit({ type: 'PHASE', phase: 'scoreboard' })
    expect(document.querySelector('[data-layout-id="tv"]')).not.toBeNull()
    emit({ type: 'PHASE', phase: 'ended' })
    expect(document.querySelector('[data-layout-id="end"]')).not.toBeNull()
    emit({ type: 'PHASE', phase: 'question' })
    expect(document.querySelector('[data-layout-id="tv"]')).not.toBeNull()
    emit({ type: 'GAME_STATUS', status: 'ended' })
    expect(document.querySelector('[data-layout-id="end"]')).not.toBeNull()
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
    emit({ type: 'SCOREBOARD', rows: [{ id: 'p1', name: 'Ann', score: 7, place: 1 }] })
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

  it('offers a scoreboard link and names scoreboard displays apart from screens', async () => {
    const onApprove = vi.fn()
    const onDisconnect = vi.fn()
    render(
      <ScreensPanel
        roomId="ABC234"
        pending={['c3']}
        connected={['c1', 'c2']}
        scoreboards={['c2', 'c3']}
        onApprove={onApprove}
        onReject={vi.fn()}
        onDisconnect={onDisconnect}
      />
    )
    expect(screen.getByTitle(/#\/scoreboard\/ABC234$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy scoreboard URL' })).toBeInTheDocument()
    expect(screen.getByText('Scoreboard 1 wants to join')).toBeInTheDocument()
    expect(screen.getByText('Screen 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Approve scoreboard 1' }))
    expect(onApprove).toHaveBeenCalledWith('c3')
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect scoreboard 1' }))
    expect(onDisconnect).toHaveBeenCalledWith('c2')
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
