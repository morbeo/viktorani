// @vitest-pool vmForks
import { describe, it, expect, vi, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import type { Game, Question } from '@/db'
import type { ITransport, TransportConfig, TransportEvent } from '@/transport/types'

// The real host and player screens, run against each other in one document. Each side
// loads its own copy of the app modules (so each has its own transport singleton), and
// PeerJS is replaced by an in-memory hub that routes messages between them.

const hub = vi.hoisted(() => {
  type Handler = (event: TransportEvent, from: string) => void
  type ConnHandler = (connId: string) => void

  const state = {
    host: null as FakeTransport | null,
    players: new Map<string, FakeTransport>(),
    seq: 0,
  }

  /** Deliver a JSON copy on a later task, like a data channel, so it is parsed on arrival. */
  function deliver(to: FakeTransport | null | undefined, event: TransportEvent, from: string) {
    const copy = JSON.parse(JSON.stringify(event)) as TransportEvent
    setTimeout(() => to?.handlers.forEach(h => h(copy, from)), 0)
  }

  class FakeTransport implements ITransport {
    status: ITransport['status'] = 'idle'
    readonly transportType = 'peer' as const
    handlers: Handler[] = []
    openHandlers: ConnHandler[] = []
    closeHandlers: ConnHandler[] = []
    private role: TransportConfig['role'] = 'host'
    private connId = ''

    async connect(config: TransportConfig) {
      this.role = config.role
      if (config.role === 'host') {
        state.host = this
      } else {
        const host = state.host
        if (!host) throw new Error('peer-unavailable')
        this.connId = `conn-${++state.seq}`
        state.players.set(this.connId, this)
        setTimeout(() => host.openHandlers.forEach(h => h(this.connId)), 0)
      }
      this.status = 'connected'
    }

    disconnect() {
      this.status = 'disconnected'
      if (this.role === 'host') {
        if (state.host === this) state.host = null
        return
      }
      if (!state.players.delete(this.connId)) return
      const host = state.host
      setTimeout(() => host?.closeHandlers.forEach(h => h(this.connId)), 0)
    }

    send(event: TransportEvent, include?: (connId: string) => boolean) {
      if (this.role === 'player') {
        deliver(state.host, event, this.connId)
        return
      }
      for (const [connId, player] of state.players) {
        if (!include || include(connId)) deliver(player, event, 'host')
      }
    }

    sendTo(connId: string, event: TransportEvent) {
      deliver(state.players.get(connId), event, 'host')
    }

    closeConnection(connId: string) {
      const player = state.players.get(connId)
      if (!player) return
      state.players.delete(connId)
      player.status = 'disconnected'
    }

    onEvent(handler: Handler) {
      this.handlers.push(handler)
      return () => {
        this.handlers = this.handlers.filter(h => h !== handler)
      }
    }

    onPeerOpen(handler: ConnHandler) {
      this.openHandlers.push(handler)
      return () => {
        this.openHandlers = this.openHandlers.filter(h => h !== handler)
      }
    }

    onPeerClose(handler: ConnHandler) {
      this.closeHandlers.push(handler)
      return () => {
        this.closeHandlers = this.closeHandlers.filter(h => h !== handler)
      }
    }

    onStatusChange() {
      return () => {}
    }
  }

  return { state, FakeTransport }
})

vi.mock('@/transport/PeerJSTransport', () => ({ PeerJSTransport: hub.FakeTransport }))

const VISIBLE = { showQuestion: true, showAnswers: true, showMedia: true }

const GAME: Game = {
  id: 'g1',
  name: 'Quiz night',
  status: 'active',
  roomId: 'ABC234',
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

const QUESTION: Question = {
  id: 'q1',
  title: 'Capital of France?',
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

// Joining and adjudicating go through several database writes on each side
const SLOW = { timeout: 5000 }

const unmounts: Array<() => void> = []

afterEach(() => {
  unmounts.splice(0).forEach(unmount => unmount())
  hub.state.host = null
  hub.state.players.clear()
})

/** Load a fresh copy of the app modules for one side and render `path` with them. */
async function mountSide(side: 'host' | 'player', path: string) {
  vi.resetModules()
  const [rtl, router, ui, GameMaster, Join, Play] = await Promise.all([
    import('@testing-library/react/pure'),
    import('react-router-dom'),
    import('@/components/ui'),
    import('@/pages/admin/GameMaster'),
    import('@/pages/player/Join'),
    import('@/pages/player/Play'),
  ])
  const { MemoryRouter, Routes, Route } = router

  const routes =
    side === 'host' ? (
      <Route path="/admin/game/:id" element={<GameMaster.default />} />
    ) : (
      <>
        <Route path="/join/:roomId" element={<Join.default />} />
        <Route path="/play/:roomId" element={<Play.default />} />
      </>
    )

  const result = rtl.render(
    <ui.ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </ui.ToastProvider>
  )
  unmounts.push(result.unmount)
  return { view: rtl.within(result.container), waitFor: rtl.waitFor }
}

async function seedGame() {
  const { db } = await import('@/db')
  await db.games.put(GAME)
  await db.rounds.put({
    id: 'r1',
    name: 'Geography',
    description: '',
    questionIds: ['q1'],
    createdAt: 0,
  })
  await db.questions.put(QUESTION)
  await db.gameQuestions.put({
    id: 'gq1',
    gameId: 'g1',
    questionId: 'q1',
    roundId: 'r1',
    order: 0,
    status: 'pending',
  })
}

/** A bare connection to the host that records what it receives. */
async function connectClient() {
  const client = new hub.FakeTransport()
  const received: TransportEvent[] = []
  client.onEvent(event => received.push(event))
  await client.connect({ role: 'player', roomId: 'ABC234' })
  return { client, received }
}

const JOIN: TransportEvent = {
  type: 'JOIN',
  playerName: 'Bob',
  deviceId: 'device-bob',
  teamId: null,
  newTeamName: null,
}

describe('game flow', () => {
  it('a player joins, buzzes, and sees the point the host awards', async () => {
    const user = userEvent.setup()
    await seedGame()

    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const player = await mountSide('player', '/join/ABC234')
    await user.type(player.view.getByLabelText('Your name'), 'Alice')
    await user.click(player.view.getByRole('button', { name: 'Continue' }))
    await user.click(await player.view.findByRole('radio', { name: 'Play on my own' }))
    await user.click(player.view.getByRole('button', { name: 'Join as Alice' }))

    // The host admits the player and sends the open buzzer and the question
    const buzz = await player.view.findByRole('button', { name: 'Buzz' }, SLOW)
    await player.waitFor(() => expect(buzz).toBeEnabled())
    expect(player.view.getByRole('heading', { name: 'Capital of France?' })).toBeInTheDocument()
    await user.click(buzz)

    await user.click(await host.view.findByRole('button', { name: 'Mark correct' }, SLOW))

    await player.waitFor(
      () => expect(player.view.getByText(/^Score/)).toHaveTextContent('Score 1'),
      SLOW
    )
  }, 20_000)

  it('a connection that joins as a player cannot also wait as a screen', async () => {
    await seedGame()
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send(JOIN)
    client.send({ type: 'SCREEN_JOIN' })

    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)
    expect(received.map(e => e.type)).not.toContain('JOIN_PENDING')
    expect(host.view.queryByRole('button', { name: 'Approve screen 1' })).toBeNull()
  }, 20_000)

  it('turns screens away once ten are waiting', async () => {
    await seedGame()
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const clients = await Promise.all(Array.from({ length: 11 }, connectClient))
    clients.forEach(({ client }) => client.send({ type: 'SCREEN_JOIN' }))

    const last = clients[10].received
    await host.waitFor(() => expect(last.map(e => e.type)).toContain('JOIN_REJECTED'))
    expect(last).toContainEqual({
      type: 'JOIN_REJECTED',
      reason: 'Too many screens are waiting. Try again later.',
    })
    for (const { received } of clients.slice(0, 10)) {
      expect(received.map(e => e.type)).toContain('JOIN_PENDING')
    }

    // The People tab counts the waiting screens; switching tabs hides the People panel
    await host.waitFor(() => {
      for (const tab of host.view.getAllByRole('tab', { name: /People/ })) {
        expect(tab).toHaveTextContent('People10')
      }
    })
    const side = host.view.getByRole('tablist', { name: 'Side panel' })
    const messagesTab = Array.from(side.querySelectorAll('[role="tab"]')).find(
      t => t.textContent === 'Messages'
    )
    await userEvent.setup().click(messagesTab as HTMLElement)
    // A hidden panel has no accessible name, so find it by id
    expect(document.getElementById('host-panel-people')).not.toBeVisible()
    expect(host.view.getByRole('tabpanel', { name: 'Messages' })).toBeVisible()
  }, 20_000)

  it('does not admit a connection that closed while its join was queued', async () => {
    await seedGame()
    const { db } = await import('@/db')
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client } = await connectClient()
    // A device of its own: earlier tests leave their players in the shared database
    client.send({ ...JOIN, playerName: 'Dora', deviceId: 'device-dora' } as TransportEvent)
    client.disconnect()
    await new Promise(r => setTimeout(r, 300))

    // Never connected as a player: either not saved, or saved as disconnected
    const saved = await db.players.where('deviceId').equals('device-dora').toArray()
    expect(saved.every(p => p.presence === 'disconnected')).toBe(true)
  }, 20_000)

  it('sends a player kicked before a host reload to approval when they rejoin', async () => {
    await seedGame()
    const { db } = await import('@/db')
    // Kicked in an earlier host session: only the saved record remembers it. A device of
    // its own, since the database is shared between tests
    await db.players.put({
      id: 'p-fay',
      gameId: 'g1',
      name: 'Fay',
      teamId: null,
      deviceId: 'device-fay',
      score: 0,
      presence: 'kicked',
      joinedAt: 1,
    })
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ ...JOIN, playerName: 'Fay', deviceId: 'device-fay' } as TransportEvent)

    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_PENDING'), SLOW)
    expect(received.map(e => e.type)).not.toContain('JOIN_ACCEPTED')
    expect((await db.players.get('p-fay'))?.presence).toBe('kicked')
  }, 20_000)

  it('ignores buzzes while the game is paused', async () => {
    await seedGame()
    const { db } = await import('@/db')
    await db.games.update('g1', { status: 'paused' })
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send(JOIN)
    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)
    client.send({ type: 'BUZZ', timestamp: Date.now() })
    await new Promise(r => setTimeout(r, 200))
    expect(host.view.queryByRole('button', { name: 'Mark correct' })).toBeNull()
  }, 20_000)

  it('an ended game stays offline and admits no one', async () => {
    await seedGame()
    const { db } = await import('@/db')
    await db.games.update('g1', { status: 'ended' })

    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(host.view.getByText(/read-only/i)).toBeInTheDocument())

    // The host never registered the room, so a player cannot reach it
    expect(hub.state.host).toBeNull()
    await expect(connectClient()).rejects.toThrow('peer-unavailable')
  }, 20_000)

  it("records the buzzer's team with the buzz", async () => {
    await seedGame()
    const { db } = await import('@/db')
    // The database is shared with earlier tests: drop their buzzes
    await db.buzzEvents.clear()
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ ...JOIN, newTeamName: 'Owls' } as TransportEvent)
    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)
    client.send({ type: 'BUZZ', timestamp: Date.now() })
    await host.waitFor(async () => expect(await db.buzzEvents.count()).toBe(1), SLOW)

    const [team] = await db.teams.where('gameId').equals('g1').toArray()
    const [buzz] = await db.buzzEvents.toArray()
    expect(team.name).toBe('Owls')
    expect(buzz.teamId).toBe(team.id)
  }, 20_000)

  it('records when a player hides their tab and when they leave', async () => {
    await seedGame()
    const { db } = await import('@/db')
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ ...JOIN, playerName: 'Eve', deviceId: 'device-eve' } as TransportEvent)
    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)
    const presence = async () =>
      (await db.players.where('deviceId').equals('device-eve').first())?.presence

    client.send({ type: 'FOCUS_CHANGE', away: true })
    await host.waitFor(async () => expect(await presence()).toBe('hidden'))
    client.send({ type: 'LEAVE' })
    await host.waitFor(async () => expect(await presence()).toBe('left'))
    const kinds = async () => (await db.gameLog.toArray()).map(e => e.kind)
    await host.waitFor(async () =>
      expect(await kinds()).toEqual(
        expect.arrayContaining(['player_joined', 'player_hidden', 'player_left'])
      )
    )
  }, 20_000)
})
