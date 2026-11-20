// @vitest-pool vmForks
import { describe, it, expect, vi, afterEach } from 'vitest'
import { within } from '@testing-library/react/pure'
import userEvent from '@testing-library/user-event'
import type { Game, GamePhase, Question, WidgetType } from '@/db'
import type { ConnectionRoute } from '@/transport/route'
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
    /** How this player's connection reaches the host. */
    route: ConnectionRoute = 'local'

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

    async connectionRoute(connId: string) {
      return state.players.get(connId)?.route ?? 'unknown'
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
    revealed: false,
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

  it('turns spectators away when the game does not allow them', async () => {
    await seedGame()
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ type: 'SCREEN_JOIN', watch: true })
    await host.waitFor(() =>
      expect(received).toContainEqual({
        type: 'JOIN_REJECTED',
        reason: "This game isn't taking spectators.",
      })
    )
    expect(received.map(e => e.type)).not.toContain('SCREEN_ACCEPTED')
  }, 20_000)

  it('lets spectators watch without approval when the game allows them', async () => {
    await seedGame()
    const { db } = await import('@/db')
    await db.games.update('g1', { allowSpectators: true })
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ type: 'SCREEN_JOIN', watch: true })
    await host.waitFor(() => expect(received.map(e => e.type)).toContain('SCREEN_ACCEPTED'), SLOW)
    expect(received.map(e => e.type)).not.toContain('JOIN_PENDING')
    expect(received.map(e => e.type)).toContain('SCOREBOARD')
    expect(await host.view.findByText('1 person watching')).toBeInTheDocument()
    expect(host.view.queryByRole('button', { name: 'Disconnect screen 1' })).toBeNull()

    // A spectator only listens: a JOIN from it is ignored
    client.send(JOIN)
    await new Promise(r => setTimeout(r, 200))
    expect(received.map(e => e.type)).not.toContain('JOIN_ACCEPTED')

    // Host messages skip spectators
    const user = userEvent.setup()
    const side = host.view.getByRole('tablist', { name: 'Side panel' })
    const messagesTab = Array.from(side.querySelectorAll('[role="tab"]')).find(
      t => t.textContent === 'Messages'
    )
    await user.click(messagesTab as HTMLElement)
    const panel = within(host.view.getByRole('tabpanel', { name: 'Messages' }))
    await user.type(panel.getByLabelText('Message'), 'Break time')
    await user.click(panel.getByRole('button', { name: 'Send' }))
    await panel.findByRole('status')
    await new Promise(r => setTimeout(r, 200))
    expect(received.map(e => e.type)).not.toContain('MESSAGE')

    // Turning spectators off sends them away
    await user.click(host.view.getAllByRole('button', { name: 'Game settings' })[0])
    await user.click(await host.view.findByRole('switch', { name: 'Allow spectators' }))
    await host.waitFor(() => expect(host.view.queryByText('1 person watching')).toBeNull())
  }, 20_000)

  it('turns away devices off the local network in a local-network-only game', async () => {
    await seedGame()
    const { db } = await import('@/db')
    await db.games.update('g1', { localNetworkOnly: true, allowSpectators: true })
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())
    const rejected = {
      type: 'JOIN_REJECTED',
      reason: "This game only takes devices on the host's local network.",
    }

    const remote = await connectClient()
    remote.client.route = 'remote'
    remote.client.send(JOIN)
    await host.waitFor(() => expect(remote.received).toContainEqual(rejected))
    expect(remote.received.map(e => e.type)).not.toContain('JOIN_ACCEPTED')

    const watcher = await connectClient()
    watcher.client.route = 'unknown'
    watcher.client.send({ type: 'SCREEN_JOIN', watch: true })
    await host.waitFor(() => expect(watcher.received).toContainEqual(rejected))
    expect(watcher.received.map(e => e.type)).not.toContain('SCREEN_ACCEPTED')

    const local = await connectClient()
    local.client.send(JOIN)
    await host.waitFor(() => expect(local.received.map(e => e.type)).toContain('JOIN_ACCEPTED'))
  }, 20_000)

  it('checks a waiting screen again when the host turns local-network-only on', async () => {
    await seedGame()
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.route = 'remote'
    client.send({ type: 'SCREEN_JOIN' })
    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_PENDING'))

    const user = userEvent.setup()
    await user.click(host.view.getAllByRole('button', { name: 'Game settings' })[0])
    const localOnly = await host.view.findByRole('switch', { name: 'Local network only' })
    await user.click(localOnly)
    // The switch follows the host's game once the setting is saved; approving before then
    // would check the screen against the old setting
    await host.waitFor(() => expect(localOnly).toBeChecked(), SLOW)
    await user.click(await host.view.findByRole('button', { name: 'Approve screen 1' }, SLOW))
    await host.waitFor(() =>
      expect(received).toContainEqual({
        type: 'JOIN_REJECTED',
        reason: "This game only takes devices on the host's local network.",
      })
    )
    expect(received.map(e => e.type)).not.toContain('SCREEN_ACCEPTED')
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
      disconnectedAt: null,
      joinedAt: 1,
      notes: '',
    })
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ ...JOIN, playerName: 'Fay', deviceId: 'device-fay' } as TransportEvent)

    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_PENDING'), SLOW)
    expect(received.map(e => e.type)).not.toContain('JOIN_ACCEPTED')
    expect((await db.players.get('p-fay'))?.presence).toBe('kicked')
  }, 20_000)

  it("marks a player disconnected past the game's timeout as left", async () => {
    const { db } = await import('@/db')
    await seedGame()
    await db.games.update('g1', { autoRemoveAfterMinutes: 1 })
    const player = {
      gameId: 'g1',
      teamId: null,
      score: 0,
      presence: 'disconnected' as const,
      joinedAt: 1,
      notes: '',
    }
    await db.players.bulkPut([
      { ...player, id: 'p-gone', name: 'Gus', deviceId: 'device-gus', disconnectedAt: 1 },
      {
        ...player,
        id: 'p-recent',
        name: 'Hal',
        deviceId: 'device-hal',
        disconnectedAt: Date.now(),
      },
    ])
    const host = await mountSide('host', '/admin/game/g1')

    await host.waitFor(
      async () => expect((await db.players.get('p-gone'))?.presence).toBe('left'),
      {
        timeout: 8000,
      }
    )
    expect((await db.players.get('p-recent'))?.presence).toBe('disconnected')
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

  it('a player picks an option on their phone and the host records it', async () => {
    const user = userEvent.setup()
    await seedGame()
    const { db } = await import('@/db')
    await db.answers.clear()
    await db.games.update('g1', { inputType: 'choice' })

    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const player = await mountSide('player', '/join/ABC234')
    await user.clear(player.view.getByLabelText('Your name'))
    await user.type(player.view.getByLabelText('Your name'), 'Carol')
    await user.click(player.view.getByRole('button', { name: 'Continue' }))
    await user.click(await player.view.findByRole('radio', { name: 'Play on my own' }))
    await user.click(player.view.getByRole('button', { name: 'Join as Carol' }))

    // The host sends the options in place of the buzz button
    const pad = await player.view.findByRole('region', { name: 'Your answer' }, SLOW)
    expect(player.view.queryByRole('button', { name: 'Buzz' })).toBeNull()
    await user.click(within(pad).getByRole('button', { name: 'B Lyon' }))

    await host.waitFor(async () => expect(await db.answers.count()).toBe(1), SLOW)
    const [answer] = await db.answers.toArray()
    const carol = await db.players.get(answer.playerId)
    expect(carol?.name).toBe('Carol')
    expect(answer).toMatchObject({ gameQuestionId: 'gq1', choice: 1, ruling: 'pending' })
  }, 20_000)

  it('a player types an answer on their phone and the host records it', async () => {
    const user = userEvent.setup()
    await seedGame()
    const { db } = await import('@/db')
    await db.answers.clear()
    await db.games.update('g1', { inputType: 'text' })

    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const player = await mountSide('player', '/join/ABC234')
    await user.clear(player.view.getByLabelText('Your name'))
    await user.type(player.view.getByLabelText('Your name'), 'Dana')
    await user.click(player.view.getByRole('button', { name: 'Continue' }))
    await user.click(await player.view.findByRole('radio', { name: 'Play on my own' }))
    await user.click(player.view.getByRole('button', { name: 'Join as Dana' }))

    // The host sends the answer box in place of the buzz button
    const box = await player.view.findByRole('form', { name: 'Your answer' }, SLOW)
    await user.type(within(box).getByRole('textbox', { name: 'Answer' }), '  Lyon {Enter}')

    await host.waitFor(async () => expect(await db.answers.count()).toBe(1), SLOW)
    const [answer] = await db.answers.toArray()
    expect((await db.players.get(answer.playerId))?.name).toBe('Dana')
    expect(answer).toMatchObject({ gameQuestionId: 'gq1', text: 'Lyon', ruling: 'pending' })
    expect(within(box).getByRole('status')).toHaveTextContent('Sent: Lyon')
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

describe('layouts over the transport', () => {
  const layout = (
    id: string,
    target: 'player' | 'screen' | 'scoreboard',
    widgets: WidgetType[],
    phase: GamePhase | null = null
  ) => ({
    layout: {
      id,
      gameId: 'g1',
      name: id,
      target,
      phase,
      theme: { background: null, accent: '#00966e', fontScale: 1, logo: null },
      isActive: true,
      order: 0,
    },
    widgets: widgets.map((type, i) => ({
      id: `${id}-${type}`,
      layoutId: id,
      type,
      config: {},
      grid: { x: 0, y: i, w: 12, h: 1 },
      breakpoints: {},
      order: i,
    })),
  })

  async function store(...bundles: ReturnType<typeof layout>[]) {
    const { db } = await import('@/db')
    await db.layouts.bulkPut(bundles.map(b => b.layout))
    await db.widgets.bulkPut(bundles.flatMap(b => b.widgets))
  }

  afterEach(async () => {
    const { db } = await import('@/db')
    await Promise.all([db.layouts.clear(), db.widgets.clear()])
  })

  const layoutsOf = (received: TransportEvent[], target: 'player' | 'screen' | 'scoreboard') =>
    received.flatMap(e =>
      e.type === 'LAYOUT' && e.target === target ? [e.layouts.map(b => b.layout.id)] : []
    )

  it('sends an admitted player the stored player layout, and resends it when it changes', async () => {
    await seedGame()
    await store(
      layout('phone', 'player', ['question', 'buzzer']),
      layout('tv', 'screen', ['question'])
    )
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ ...JOIN, playerName: 'Gus', deviceId: 'device-gus' } as TransportEvent)
    await host.waitFor(() => expect(layoutsOf(received, 'player')).toContainEqual(['phone']), SLOW)
    expect(layoutsOf(received, 'screen')).toEqual([])

    // An all-phase layout would lose to 'phone' on order; one for the end of the game is added
    await store(layout('phone-2', 'player', ['question'], 'ended'))
    await host.waitFor(() =>
      expect(layoutsOf(received, 'player').at(-1)?.sort()).toEqual(['phone', 'phone-2'].sort())
    )
  }, 20_000)

  it('sends an approved screen the stored screen layout', async () => {
    const user = userEvent.setup()
    await seedGame()
    await store(layout('tv', 'screen', ['question', 'scoreboard']))
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ type: 'SCREEN_JOIN' })
    await user.click(await host.view.findByRole('button', { name: 'Approve screen 1' }, SLOW))
    await host.waitFor(() => expect(layoutsOf(received, 'screen')).toContainEqual(['tv']), SLOW)
  }, 20_000)

  it('sends an approved scoreboard device the stored scoreboard layout, not the screen one', async () => {
    const user = userEvent.setup()
    await seedGame()
    await store(
      layout('tv', 'screen', ['question']),
      layout('board', 'scoreboard', ['leaderboard'])
    )
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ type: 'SCREEN_JOIN', surface: 'scoreboard' })
    await user.click(await host.view.findByRole('button', { name: 'Approve scoreboard 1' }, SLOW))
    await host.waitFor(
      () => expect(layoutsOf(received, 'scoreboard')).toContainEqual(['board']),
      SLOW
    )
    expect(layoutsOf(received, 'screen')).toEqual([])
    expect(received.map(e => e.type)).toEqual(expect.arrayContaining(['SCOREBOARD', 'LOG']))
    expect(host.view.getByText('Scoreboard 1')).toBeInTheDocument()

    // A change to the stored scoreboard layouts is resent to it
    await store(layout('board-end', 'scoreboard', ['game_log'], 'ended'))
    await host.waitFor(() =>
      expect(layoutsOf(received, 'scoreboard').at(-1)?.sort()).toEqual(['board', 'board-end'])
    )
    expect(layoutsOf(received, 'screen')).toEqual([])
  }, 20_000)

  it("renders the host's player layout on the player's phone", async () => {
    const user = userEvent.setup()
    await seedGame()
    await store(layout('phone', 'player', ['question']))
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const player = await mountSide('player', '/join/ABC234')
    // The first test's name is remembered on this device
    await user.clear(player.view.getByLabelText('Your name'))
    await user.type(player.view.getByLabelText('Your name'), 'Hal')
    await user.click(player.view.getByRole('button', { name: 'Continue' }))
    await user.click(await player.view.findByRole('radio', { name: 'Play on my own' }))
    await user.click(player.view.getByRole('button', { name: 'Join as Hal' }))

    await player.waitFor(
      () => expect(document.querySelector('[data-layout-id="phone"]')).not.toBeNull(),
      SLOW
    )
    // Only the question: the stored layout has no buzz button
    expect(player.view.getByRole('heading', { name: 'Capital of France?' })).toBeInTheDocument()
    expect(player.view.queryByRole('button', { name: 'Buzz' })).toBeNull()
  }, 20_000)
})

describe('layout phase over the transport', () => {
  const phasesOf = (received: TransportEvent[]) =>
    received.flatMap(e => (e.type === 'PHASE' ? [e.phase] : []))

  it('follows the buzzes, and the GM can hold a phase by hand', async () => {
    const user = userEvent.setup()
    await seedGame()
    const { db } = await import('@/db')
    await db.buzzEvents.clear()
    localStorage.removeItem('viktorani:layout-phase:g1')
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ ...JOIN, playerName: 'Ivy', deviceId: 'device-ivy' } as TransportEvent)
    await host.waitFor(() => expect(phasesOf(received)).toContain('question'), SLOW)

    client.send({ type: 'BUZZ', timestamp: Date.now() })
    await host.waitFor(() => expect(phasesOf(received).at(-1)).toBe('buzzed'), SLOW)

    const picker = await host.view.findByLabelText('Layouts for')
    expect(picker).toHaveDisplayValue('Automatic (Buzzed)')
    await user.selectOptions(picker, 'scoreboard')
    await host.waitFor(() => expect(phasesOf(received).at(-1)).toBe('scoreboard'))
    // Kept for the projector window on this machine
    expect(localStorage.getItem('viktorani:layout-phase:g1')).toBe('scoreboard')

    await user.selectOptions(picker, '')
    await host.waitFor(() => expect(phasesOf(received).at(-1)).toBe('buzzed'))
    expect(localStorage.getItem('viktorani:layout-phase:g1')).toBeNull()
  }, 20_000)

  it('keeps screens on the taken layout in studio mode, while phones follow the game', async () => {
    const user = userEvent.setup()
    await seedGame()
    const { db } = await import('@/db')
    await db.buzzEvents.clear()
    localStorage.removeItem('viktorani:layout-phase:g1')
    localStorage.removeItem('viktorani:studio:g1')
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const phone = await connectClient()
    phone.client.send({ ...JOIN, playerName: 'Kit', deviceId: 'device-kit' } as TransportEvent)
    await host.waitFor(() => expect(phasesOf(phone.received)).toContain('question'), SLOW)
    const tv = await connectClient()
    tv.client.send({ type: 'SCREEN_JOIN' })
    await user.click(await host.view.findByRole('button', { name: 'Approve screen 1' }, SLOW))
    await host.waitFor(() => expect(phasesOf(tv.received)).toEqual(['question']), SLOW)

    await user.click(host.view.getByRole('switch', { name: 'Studio mode' }))
    expect(JSON.parse(localStorage.getItem('viktorani:studio:g1') ?? 'null')).toEqual({
      program: 'question',
      transition: 'cut',
    })
    phone.client.send({ type: 'BUZZ', timestamp: Date.now() })
    await host.waitFor(() => expect(phasesOf(phone.received).at(-1)).toBe('buzzed'), SLOW)
    // The screen stays on the question until the GM takes the buzz
    expect(phasesOf(tv.received)).toEqual(['question'])
    expect(host.view.getByText(/Next:/)).toHaveTextContent('Next: Buzzed')

    await user.click(host.view.getByRole('button', { name: 'Take' }))
    await host.waitFor(() =>
      expect(tv.received.filter(e => e.type === 'PHASE').at(-1)).toEqual({
        type: 'PHASE',
        phase: 'buzzed',
        transition: 'fade',
      })
    )

    // A slow wipe carries its speed; the GM's pick stays for the next take
    await user.selectOptions(host.view.getByLabelText('Transition'), 'wipe')
    await user.selectOptions(host.view.getByLabelText('Speed'), 'slow')
    await user.selectOptions(await host.view.findByLabelText('Layouts for'), 'reveal')
    await host.waitFor(() => expect(phasesOf(phone.received).at(-1)).toBe('reveal'))
    await user.click(host.view.getByRole('button', { name: 'Take' }))
    await host.waitFor(() =>
      expect(tv.received.filter(e => e.type === 'PHASE').at(-1)).toEqual({
        type: 'PHASE',
        phase: 'reveal',
        transition: 'wipe',
        speed: 'slow',
      })
    )

    // Hold the scoreboard, then leave studio mode: the screens cut back to the game
    await user.selectOptions(await host.view.findByLabelText('Layouts for'), 'scoreboard')
    await host.waitFor(() => expect(phasesOf(phone.received).at(-1)).toBe('scoreboard'))
    expect(phasesOf(tv.received).at(-1)).toBe('reveal')
    await user.click(host.view.getByRole('switch', { name: 'Studio mode' }))
    await host.waitFor(() =>
      expect(tv.received.filter(e => e.type === 'PHASE').at(-1)).toEqual({
        type: 'PHASE',
        phase: 'scoreboard',
      })
    )
    localStorage.removeItem('viktorani:layout-phase:g1')
  }, 20_000)
})

describe('theme over the transport', () => {
  it("sends a joining player the game's theme, resolved", async () => {
    await seedGame()
    const { db } = await import('@/db')
    await db.games.update('g1', { themeId: 'pub' })
    const host = await mountSide('host', '/admin/game/g1')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())

    const { client, received } = await connectClient()
    client.send({ ...JOIN, playerName: 'Jo', deviceId: 'device-jo' } as TransportEvent)
    const themeOf = () => received.find(e => e.type === 'THEME')
    await host.waitFor(() => expect(themeOf()).toBeDefined(), SLOW)
    const event = themeOf() as Extract<TransportEvent, { type: 'THEME' }>
    expect(event.theme.name).toBe('Pub')
    expect(event.theme.dark.onAccent).toMatch(/^#[0-9a-f]{6}$/i)
  }, 20_000)
})

describe('lobby over the transport', () => {
  /** A waiting game of its own, since the database is shared between tests. */
  async function seedLobby(patch: Partial<Game> = {}) {
    await seedGame()
    const { db } = await import('@/db')
    await db.games.put({ ...GAME, id: 'g2', status: 'waiting', ...patch })
    await db.gameQuestions.put({
      id: 'gq2',
      gameId: 'g2',
      questionId: 'q1',
      roundId: 'r1',
      order: 0,
      status: 'pending',
      revealed: false,
    })
    await db.teams.where('gameId').equals('g2').delete()
    await db.players.where('gameId').equals('g2').delete()
    return db
  }

  async function mountLobby() {
    const host = await mountSide('host', '/admin/game/g2')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())
    await host.view.findByText('Lobby · waiting for players')
    return host
  }

  const joinAs = (name: string) =>
    ({ ...JOIN, playerName: name, deviceId: `device-${name.toLowerCase()}` }) as TransportEvent

  it('starts the game once a player joins, and tells the players', async () => {
    const user = userEvent.setup()
    const db = await seedLobby()
    const host = await mountLobby()

    const start = host.view.getByRole('button', { name: 'Start game' })
    expect(start).toBeDisabled()
    expect(host.view.getByText('No players connected yet')).toBeInTheDocument()

    const { client, received } = await connectClient()
    client.send(joinAs('Ivy'))
    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)
    await host.waitFor(() => expect(start).toBeEnabled())
    expect(host.view.getByText('1 player connected')).toBeInTheDocument()

    await user.click(start)
    await host.waitFor(() =>
      expect(received).toContainEqual({ type: 'GAME_STATUS', status: 'active' })
    )
    expect((await db.games.get('g2'))?.status).toBe('active')
    await host.waitFor(async () => {
      const kinds = (await db.gameLog.where('gameId').equals('g2').toArray()).map(e => e.kind)
      expect(kinds).toContain('game_started')
    })
    expect(host.view.queryByText('Lobby · waiting for players')).toBeNull()
  }, 20_000)

  it('starts with no players in solo mode', async () => {
    const user = userEvent.setup()
    const db = await seedLobby()
    const host = await mountLobby()

    const start = host.view.getByRole('button', { name: 'Start game' })
    expect(start).toBeDisabled()
    await user.click(host.view.getByRole('switch'))
    expect(host.view.getByText('Solo mode — 0 players connected')).toBeInTheDocument()
    await user.click(start)
    await host.waitFor(async () => expect((await db.games.get('g2'))?.status).toBe('active'))
  }, 20_000)

  it('admits a waiting player the host approves, and turns away one the host rejects', async () => {
    const user = userEvent.setup()
    await seedLobby({ requireApproval: true })
    const host = await mountLobby()

    const jo = await connectClient()
    jo.client.send(joinAs('Jo'))
    const kim = await connectClient()
    kim.client.send(joinAs('Kim'))
    await host.waitFor(() => expect(jo.received.map(e => e.type)).toContain('JOIN_PENDING'))
    await host.waitFor(() => expect(kim.received.map(e => e.type)).toContain('JOIN_PENDING'))

    await user.click(await host.view.findByRole('button', { name: 'Approve Jo' }))
    await host.waitFor(() => expect(jo.received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)

    await user.click(host.view.getByRole('button', { name: 'Reject Kim' }))
    await host.waitFor(() =>
      expect(kim.received).toContainEqual({
        type: 'JOIN_REJECTED',
        reason: 'The host declined your request',
      })
    )
    expect(kim.received.map(e => e.type)).not.toContain('JOIN_ACCEPTED')
    expect(host.view.queryByRole('button', { name: 'Approve Kim' })).toBeNull()
  }, 20_000)

  it('rejects an approved join that the game no longer has room for', async () => {
    const user = userEvent.setup()
    await seedLobby({ requireApproval: true, maxPlayers: 1 })
    const host = await mountLobby()

    const lee = await connectClient()
    lee.client.send(joinAs('Lee'))
    const max = await connectClient()
    max.client.send(joinAs('Max'))
    await user.click(await host.view.findByRole('button', { name: 'Approve Lee' }))
    await host.waitFor(() => expect(lee.received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)

    // Max waited while Lee took the last place
    await user.click(host.view.getByRole('button', { name: 'Approve Max' }))
    await host.waitFor(() => expect(max.received.map(e => e.type)).toContain('JOIN_REJECTED'), SLOW)
    expect(max.received.map(e => e.type)).not.toContain('JOIN_ACCEPTED')
    expect(await host.view.findByText(/Max could not join/)).toBeInTheDocument()
  }, 20_000)

  it('kicks a player from the roster and tells the others', async () => {
    const user = userEvent.setup()
    const db = await seedLobby()
    const host = await mountLobby()

    const ned = await connectClient()
    ned.client.send(joinAs('Ned'))
    const oli = await connectClient()
    oli.client.send(joinAs('Oli'))
    await host.waitFor(() => expect(ned.received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)
    await host.waitFor(() => expect(oli.received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)

    const statesBefore = oli.received.filter(e => e.type === 'GAME_STATE').length
    await user.click(await host.view.findByRole('button', { name: 'Kick Ned' }))
    await host.waitFor(async () => {
      const ned = await db.players.where('deviceId').equals('device-ned').first()
      expect(ned?.presence).toBe('kicked')
    })
    await host.waitFor(() =>
      expect(oli.received.filter(e => e.type === 'GAME_STATE').length).toBeGreaterThan(statesBefore)
    )
  }, 20_000)

  it('marks a player whose connection drops as disconnected', async () => {
    const db = await seedLobby()
    const host = await mountLobby()

    const { client, received } = await connectClient()
    client.send(joinAs('Pam'))
    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)
    client.disconnect()

    await host.waitFor(async () => {
      const pam = await db.players.where('deviceId').equals('device-pam').first()
      expect(pam?.presence).toBe('disconnected')
      expect(pam?.disconnectedAt).toEqual(expect.any(Number))
    })
    await host.waitFor(async () => {
      const kinds = (await db.gameLog.where('gameId').equals('g2').toArray()).map(e => e.kind)
      expect(kinds).toContain('player_disconnected')
    })
  }, 20_000)

  it('creates, renames and deletes a team, keeping its members in the game', async () => {
    const user = userEvent.setup()
    const db = await seedLobby()
    const host = await mountLobby()

    await user.type(host.view.getAllByRole('textbox', { name: 'New team name' })[0], 'Owls')
    await user.click(host.view.getByRole('button', { name: 'Create team' }))
    await host.waitFor(async () =>
      expect((await db.teams.where('gameId').equals('g2').toArray()).map(t => t.name)).toEqual([
        'Owls',
      ])
    )
    const owls = (await db.teams.where('gameId').equals('g2').first())!

    // A host-added player on the new team
    await user.click(host.view.getByRole('button', { name: 'Add player' }))
    await user.type(host.view.getByRole('textbox', { name: 'New player name' }), 'Quinn')
    await user.selectOptions(
      host.view.getByRole('combobox', { name: "New player's team" }),
      owls.id
    )
    await user.click(host.view.getByRole('button', { name: 'Add' }))
    await host.waitFor(async () => {
      const quinn = await db.players.where('gameId').equals('g2').first()
      expect(quinn).toMatchObject({ name: 'Quinn', teamId: owls.id })
    })

    await user.click(host.view.getByRole('button', { name: 'Rename Owls' }))
    const rename = host.view.getByRole('textbox', { name: 'Rename Owls' })
    await user.clear(rename)
    await user.type(rename, 'Night Owls{Enter}')
    await host.waitFor(async () => expect((await db.teams.get(owls.id))?.name).toBe('Night Owls'))

    await user.click(await host.view.findByRole('button', { name: 'Delete Night Owls' }))
    // The confirmation has no dialog role, so find it by its text
    const prompt = await host.view.findByText(/^Deleting Night Owls/)
    await user.click(within(prompt.parentElement!).getByRole('button', { name: 'Delete' }))
    await host.waitFor(async () => expect(await db.teams.get(owls.id)).toBeUndefined())
    const quinn = await db.players.where('gameId').equals('g2').first()
    expect(quinn).toMatchObject({ name: 'Quinn', teamId: null })
  }, 20_000)

  it('imports managed teams and players once, skipping archived ones', async () => {
    const user = userEvent.setup()
    const db = await seedLobby()
    const managed = { labelIds: [], totalScore: 0, gameLog: [] }
    await db.managedTeams.bulkPut([
      {
        ...managed,
        id: 'mt-1',
        name: 'Foxes',
        color: '#f00',
        icon: 'Zap',
        playerIds: ['mp-1'],
        archivedAt: null,
      },
      {
        ...managed,
        id: 'mt-2',
        name: 'Old',
        color: '#000',
        icon: 'Zap',
        playerIds: [],
        archivedAt: new Date(),
      },
    ])
    await db.managedPlayers.bulkPut([
      { ...managed, id: 'mp-1', name: 'Rae', teamIds: ['mt-1'], archivedAt: null },
      { ...managed, id: 'mp-2', name: 'Sol', teamIds: [], archivedAt: null },
    ])
    const host = await mountLobby()

    const importButton = host.view.getByRole('button', { name: 'Import' })
    await user.click(importButton)
    await host.waitFor(async () =>
      expect(await db.players.where('gameId').equals('g2').count()).toBe(2)
    )
    const teams = await db.teams.where('gameId').equals('g2').toArray()
    expect(teams.map(t => t.name)).toEqual(['Foxes'])
    const rae = await db.players
      .where('gameId')
      .equals('g2')
      .filter(p => p.name === 'Rae')
      .first()
    expect(rae?.teamId).toBe(teams[0].id)

    // Importing again adds no duplicates
    await host.waitFor(() => expect(importButton).toBeEnabled())
    await user.click(importButton)
    await host.waitFor(() => expect(importButton).toBeEnabled())
    expect(await db.teams.where('gameId').equals('g2').count()).toBe(1)
    expect(await db.players.where('gameId').equals('g2').count()).toBe(2)
    await db.managedTeams.clear()
    await db.managedPlayers.clear()
  }, 20_000)

  it('approves, rejects and disconnects screens', async () => {
    const user = userEvent.setup()
    await seedLobby()
    const host = await mountLobby()

    const first = await connectClient()
    first.client.send({ type: 'SCREEN_JOIN' })
    await host.waitFor(() => expect(first.received.map(e => e.type)).toContain('JOIN_PENDING'))
    await user.click(await host.view.findByRole('button', { name: 'Approve screen 1' }))
    await host.waitFor(() => expect(first.received.map(e => e.type)).toContain('SCREEN_ACCEPTED'))

    const second = await connectClient()
    second.client.send({ type: 'SCREEN_JOIN' })
    await user.click(await host.view.findByRole('button', { name: 'Reject screen 1' }))
    await host.waitFor(() =>
      expect(second.received).toContainEqual({
        type: 'JOIN_REJECTED',
        reason: 'The host declined the screen',
      })
    )

    await user.click(host.view.getByRole('button', { name: 'Disconnect screen 1' }))
    await host.waitFor(() => expect(first.client.status).toBe('disconnected'))
    expect(host.view.queryByRole('button', { name: 'Disconnect screen 1' })).toBeNull()
  }, 20_000)
})

describe("the assistant's tools in the game master", () => {
  type Tool = { name: string; execute(args: Record<string, unknown>): Promise<string> }
  const tools = new Map<string, Tool>()

  afterEach(() => {
    tools.clear()
    localStorage.removeItem('viktorani:ai-tools')
    Object.defineProperty(document, 'modelContext', { value: undefined, configurable: true })
  })

  /** Switch the tools on and offer a WebMCP entry point that records what is registered. */
  async function offerWebMcp() {
    const { writeAiToolsEnabled } = await import('@/lib/ai-tools')
    writeAiToolsEnabled(true)
    const mc = {
      registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => {
        tools.set(tool.name, tool)
        options?.signal?.addEventListener('abort', () => tools.delete(tool.name))
      },
    }
    Object.defineProperty(document, 'modelContext', { value: mc, configurable: true })
  }

  const run = (name: string, args: Record<string, unknown> = {}) => {
    const tool = tools.get(name)
    if (!tool) throw new Error(`${name} is not registered`)
    return tool.execute(args)
  }

  it('runs the game through the live and play tools', async () => {
    const user = userEvent.setup()
    await seedGame()
    const { db } = await import('@/db')
    await db.games.put({ ...GAME, id: 'g3' })
    await db.gameQuestions.put({
      id: 'gq3',
      gameId: 'g3',
      questionId: 'q1',
      roundId: 'r1',
      order: 0,
      status: 'pending',
      revealed: false,
    })
    await offerWebMcp()
    const host = await mountSide('host', '/admin/game/g3')
    await host.waitFor(() => expect(hub.state.host).not.toBeNull())
    await host.waitFor(() => expect(tools.has('get_question')).toBe(true), SLOW)

    const { client, received } = await connectClient()
    client.send({ ...JOIN, playerName: 'Uma', deviceId: 'device-uma' } as TransportEvent)
    await host.waitFor(() => expect(received.map(e => e.type)).toContain('JOIN_ACCEPTED'), SLOW)

    expect(await run('get_game')).toContain('Uma')
    expect(await run('get_question')).toContain('Capital of France?')

    await run('adjust_score', { player: 'Uma', points: 3 })
    const uma = await db.players.where('deviceId').equals('device-uma').first()
    expect(uma?.score).toBe(3)

    expect(await run('send_message', { to: 'everyone', text: 'Two minutes' })).toBe(
      'Sent to 1 device.'
    )
    await host.waitFor(() =>
      expect(received).toContainEqual({ type: 'MESSAGE', text: 'Two minutes' })
    )

    await run('set_buzzer', { locked: true })
    await host.waitFor(async () => expect((await db.games.get('g3'))?.buzzerLocked).toBe(true))

    expect(await run('pause_game')).toBe('Paused.')
    await host.waitFor(async () => expect((await db.games.get('g3'))?.status).toBe('paused'))
    expect(await run('resume_game')).toBe('Resumed.')
    await host.waitFor(async () => expect((await db.games.get('g3'))?.status).toBe('active'))

    // Kicking waits for the host's Allow
    const kicked = run('kick_player', { player: 'Uma' })
    await user.click(await host.view.findByRole('button', { name: 'Allow' }))
    expect(await kicked).toBe('Kicked Uma.')
    expect((await db.players.get(uma!.id))?.presence).toBe('kicked')

    const ended = run('end_game')
    await user.click(await host.view.findByRole('button', { name: 'Allow' }))
    expect(await ended).toBe('The game has ended.')
    expect((await db.games.get('g3'))?.status).toBe('ended')
  }, 20_000)
})
