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

vi.mock('@/transport', () => ({
  transportManager: {
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
}))

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

  it('shows the rejection reason', async () => {
    renderScreen()
    await waitFor(() => expect(transportManager.send).toHaveBeenCalled())
    emit({ type: 'JOIN_REJECTED', reason: 'The host declined the screen' })
    expect(screen.getByRole('alert')).toHaveTextContent('The host declined the screen')
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
        onApprove={onApprove}
        onReject={onReject}
      />
    )
    expect(screen.getByTitle(/#\/screen\/ABC234$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Approve screen 2' }))
    expect(onApprove).toHaveBeenCalledWith('c2')
    await userEvent.click(screen.getByRole('button', { name: 'Reject screen 1' }))
    expect(onReject).toHaveBeenCalledWith('c1')
  })
})
