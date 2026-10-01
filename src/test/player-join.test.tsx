// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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
}))

import { transportManager } from '@/transport'
import Join from '@/pages/player/Join'

const LOBBY: TransportEvent = {
  type: 'LOBBY_INFO',
  teams: [{ id: 't1', name: 'Owls' }],
  allowIndividual: true,
  allowPlayerTeams: true,
}

function emit(event: TransportEvent) {
  act(() => bus.handlers.forEach(h => h(event, 'host')))
}

function renderJoin(path = '/join/abc-234') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join" element={<Join />} />
        <Route path="/join/:roomId" element={<Join />} />
        <Route path="/play/:roomId" element={<p>Play screen</p>} />
      </Routes>
    </MemoryRouter>
  )
}

/** Fill in the name, connect and receive LOBBY_INFO. */
async function reachChoices(lobby: TransportEvent = LOBBY) {
  renderJoin()
  await userEvent.type(screen.getByLabelText('Your name'), 'Alice')
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  emit(lobby)
}

function lastJoin() {
  const calls = vi.mocked(transportManager.send).mock.calls
  return calls[calls.length - 1]?.[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  bus.handlers.length = 0
  bus.closeHandlers.length = 0
  vi.mocked(transportManager.connect).mockResolvedValue(undefined)
})

describe('Join', () => {
  it('prefills the room code from the link and connects as a player', async () => {
    renderJoin()
    expect(screen.getByLabelText('Room code')).toHaveValue('ABC234')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Your name'), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(transportManager.connect).toHaveBeenCalledWith({ role: 'player', roomId: 'ABC234' })
    expect(screen.getByRole('status')).toHaveTextContent('Connecting')
  })

  it('needs a full room code when opened without a link', async () => {
    renderJoin('/join')
    await userEvent.type(screen.getByLabelText('Your name'), 'Alice')
    await userEvent.type(screen.getByLabelText('Room code'), 'abc')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Room code'), '234')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('shows an error when the room cannot be reached', async () => {
    vi.mocked(transportManager.connect).mockRejectedValue(new Error('peer-unavailable'))
    renderJoin()
    await userEvent.type(screen.getByLabelText('Your name'), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach that room')
  })

  it('offers the choices the host allows and follows updates live', async () => {
    await reachChoices()
    expect(screen.getByRole('radio', { name: 'Owls' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Create a new team' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Play on my own' })).toBeInTheDocument()

    emit({ ...LOBBY, allowIndividual: false, allowPlayerTeams: false })
    expect(screen.queryByRole('radio', { name: 'Create a new team' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Play on my own' })).not.toBeInTheDocument()
  })

  it('sends JOIN for an existing team with a stable device id', async () => {
    await reachChoices()
    await userEvent.click(screen.getByRole('radio', { name: 'Owls' }))
    await userEvent.click(screen.getByRole('button', { name: 'Join as Alice' }))
    expect(lastJoin()).toEqual({
      type: 'JOIN',
      playerName: 'Alice',
      deviceId: expect.any(String),
      teamId: 't1',
      newTeamName: null,
    })
    expect(localStorage.getItem('viktorani-device-id')).toBe(
      (lastJoin() as { deviceId: string }).deviceId
    )
  })

  it('sends JOIN with a new team name or alone', async () => {
    await reachChoices()
    await userEvent.click(screen.getByRole('radio', { name: 'Create a new team' }))
    expect(screen.getByRole('button', { name: 'Join as Alice' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Team name'), 'Foxes')
    await userEvent.click(screen.getByRole('button', { name: 'Join as Alice' }))
    expect(lastJoin()).toMatchObject({ teamId: null, newTeamName: 'Foxes' })
  })

  it('shows the pending and rejected states', async () => {
    await reachChoices()
    await userEvent.click(screen.getByRole('radio', { name: 'Play on my own' }))
    await userEvent.click(screen.getByRole('button', { name: 'Join as Alice' }))
    expect(lastJoin()).toMatchObject({ teamId: null, newTeamName: null })

    emit({ type: 'JOIN_PENDING' })
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the host')

    emit({ type: 'JOIN_REJECTED', reason: 'The host declined your request' })
    expect(screen.getByRole('alert')).toHaveTextContent('The host declined your request')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('radio', { name: 'Owls' })).toBeInTheDocument()
  })

  it('moves to the play screen once accepted and keeps the connection', async () => {
    await reachChoices()
    emit({ type: 'JOIN_ACCEPTED', playerId: 'p1', teamId: null })
    expect(screen.getByText('Play screen')).toBeInTheDocument()
    expect(transportManager.disconnect).not.toHaveBeenCalled()
  })

  it('reports a lost connection before joining', async () => {
    await reachChoices()
    act(() => bus.closeHandlers.forEach(h => h('host')))
    expect(screen.getByRole('alert')).toHaveTextContent('Lost the connection')
  })
})
