// Transport implementation smoke tests — PeerJSTransport.
// It depends on the live PeerJS network. We mock it so the class logic can be
// exercised without any real WebRTC connection. No `any` casts — types are
// threaded through properly.

import { describe, it, expect, vi } from 'vitest'
import type { TransportConfig, TransportEvent } from '@/transport/types'

// ── PeerJSTransport ───────────────────────────────────────────────────────────
//
// PeerJS is a proper npm package — we mock it with vi.mock.

vi.mock('peerjs', () => {
  type Handler = (...args: unknown[]) => void
  type EventMap = Record<string, Handler[]>

  class MockDataConnection {
    peer: string
    connectionId: string
    open = true
    private events: EventMap = {}

    constructor(peer: string) {
      this.peer = peer
      this.connectionId = `dc_${peer}`
    }

    on(event: string, handler: Handler) {
      if (!this.events[event]) this.events[event] = []
      this.events[event].push(handler)
    }

    emit(event: string, ...args: unknown[]) {
      this.events[event]?.forEach(h => h(...args))
    }

    send = vi.fn()
    close = vi.fn()
  }

  class MockPeer {
    private events: EventMap = {}
    static lastInstance: MockPeer

    constructor() {
      MockPeer.lastInstance = this
    }

    on(event: string, handler: Handler) {
      if (!this.events[event]) this.events[event] = []
      this.events[event].push(handler)
    }

    emit(event: string, ...args: unknown[]) {
      this.events[event]?.forEach(h => h(...args))
    }

    connect(peerId: string) {
      const conn = new MockDataConnection(peerId)
      return conn
    }

    destroy = vi.fn()
  }

  return { default: MockPeer }
})

import Peer from 'peerjs'
const MockPeer = Peer as unknown as {
  lastInstance: InstanceType<typeof Peer> & {
    emit(event: string, ...args: unknown[]): void
    connect(id: string): {
      emit(e: string, ...args: unknown[]): void
      send: ReturnType<typeof vi.fn>
      open: boolean
      peer: string
    }
  }
}

const PEER_HOST_CONFIG: TransportConfig = {
  role: 'host',
  roomId: 'ROOM1',
}

const PEER_PLAYER_CONFIG: TransportConfig = {
  role: 'player',
  roomId: 'ROOM1',
}

/** A host-side DataConnection stub; fire its handlers via `on.mock.calls`. */
function mockConn(peer: string) {
  return {
    peer,
    connectionId: `dc_${peer}`,
    open: true,
    send: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
  }
}

describe('PeerJSTransport', () => {
  it('starts in idle status', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()
    expect(t.status).toBe('idle')
    expect(t.transportType).toBe('peer')
  })

  it('connects as host: resolves when peer emits open', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    expect(t.status).toBe('connected')
  })

  it('connects as player: resolves only once the channel to the host is open', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_PLAYER_CONFIG)
    const peer = MockPeer.lastInstance as unknown as {
      emit(e: string, ...a: unknown[]): void
      connect: (id: string) => { emit(e: string, ...a: unknown[]): void; peer: string }
    }
    const origConnect = peer.connect.bind(peer)
    let conn: ReturnType<typeof peer.connect> | null = null
    peer.connect = (id: string) => {
      conn = origConnect(id)
      return conn
    }
    let resolved = false
    void connectPromise.then(() => {
      resolved = true
    })

    peer.emit('open')
    await Promise.resolve()
    expect(conn!.peer).toBe('vkt-ROOM1')
    expect(resolved).toBe(false)
    expect(t.status).toBe('connecting')

    conn!.emit('open')
    await connectPromise
    expect(t.status).toBe('connected')
  })

  it('rejects when peer emits error', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('error', new Error('Network error'))

    await expect(connectPromise).rejects.toThrow('Network error')
    expect(t.status).toBe('error')
  })

  it('sets status to disconnected when peer emits disconnected event', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    MockPeer.lastInstance.emit('disconnected')
    expect(t.status).toBe('disconnected')
  })

  it('disconnect: calls peer.destroy and clears connections', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    t.disconnect()
    expect(t.status).toBe('disconnected')
    expect(MockPeer.lastInstance.destroy).toHaveBeenCalled()
  })

  it('disconnect before connect does not throw', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()
    expect(() => t.disconnect()).not.toThrow()
  })

  it('host: send broadcasts to all open connections', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    // Simulate two player connections arriving
    const conn1 = mockConn('p1')
    const conn2 = mockConn('p2')

    // Trigger connection handler for each
    const peer = MockPeer.lastInstance as unknown as { emit(e: string, ...a: unknown[]): void }
    peer.emit('connection', conn1)
    // Fire 'open' on the connection so it gets stored
    conn1.on.mock.calls.find((args: unknown[]) => args[0] === 'open')?.[1]?.()
    peer.emit('connection', conn2)
    conn2.on.mock.calls.find((args: unknown[]) => args[0] === 'open')?.[1]?.()

    const event: TransportEvent = { type: 'BUZZER_LOCK' }
    t.send(event)

    expect(conn1.send).toHaveBeenCalledWith(event)
    expect(conn2.send).toHaveBeenCalledWith(event)

    // With a filter, connections it rejects are skipped
    const unlock: TransportEvent = { type: 'BUZZER_UNLOCK' }
    t.send(unlock, connId => connId === conn1.connectionId)
    expect(conn1.send).toHaveBeenCalledWith(unlock)
    expect(conn2.send).not.toHaveBeenCalledWith(unlock)
  })

  it('send is a no-op when not connected', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()
    expect(() => t.send({ type: 'BUZZER_LOCK' })).not.toThrow()
  })

  it('onEvent returns an unsubscribe function', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()
    const handler = vi.fn()
    const unsub = t.onEvent(handler)
    unsub()
    expect(handler).not.toHaveBeenCalled()
  })

  it('connection: data event forwards to registered onEvent handlers', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    const received: TransportEvent[] = []
    t.onEvent(e => received.push(e))

    const conn = mockConn('p1')
    const peer = MockPeer.lastInstance as unknown as { emit(e: string, ...a: unknown[]): void }
    peer.emit('connection', conn)

    // Fire open so the connection is stored
    conn.on.mock.calls.find((args: unknown[]) => args[0] === 'open')?.[1]?.()
    // Fire data
    const event: TransportEvent = { type: 'BUZZER_LOCK' }
    conn.on.mock.calls.find((args: unknown[]) => args[0] === 'data')?.[1]?.(event)

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(event)
  })

  it('player: closes connections from other peers and ignores their data', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()
    // Never opened here; the connect timeout rejects later
    t.connect(PEER_PLAYER_CONFIG).catch(() => {})

    const received: TransportEvent[] = []
    t.onEvent(e => received.push(e))

    const conn = mockConn('intruder')
    const peer = MockPeer.lastInstance as unknown as { emit(e: string, ...a: unknown[]): void }
    peer.emit('connection', conn)

    expect(conn.close).toHaveBeenCalled()
    expect(conn.on).not.toHaveBeenCalled()
    expect(received).toHaveLength(0)
  })

  it('host: passes the connection id and sendTo reaches only that connection', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    const froms: string[] = []
    t.onEvent((_e, from) => froms.push(from))

    const conn1 = mockConn('p1')
    const conn2 = mockConn('p2')
    const peer = MockPeer.lastInstance as unknown as { emit(e: string, ...a: unknown[]): void }
    const fire = (c: ReturnType<typeof mockConn>, name: string, ...a: unknown[]) =>
      c.on.mock.calls.find((args: unknown[]) => args[0] === name)?.[1]?.(...a)
    peer.emit('connection', conn1)
    fire(conn1, 'open')
    peer.emit('connection', conn2)
    fire(conn2, 'open')

    fire(conn2, 'data', { type: 'LEAVE' })
    expect(froms).toEqual(['dc_p2'])

    const event: TransportEvent = { type: 'JOIN_ACCEPTED', playerId: 'x', teamId: null }
    t.sendTo('dc_p2', event)
    expect(conn2.send).toHaveBeenCalledWith(event)
    expect(conn1.send).not.toHaveBeenCalled()

    t.sendTo('unknown', event)
    expect(conn1.send).not.toHaveBeenCalled()
  })

  it('host: notifies open handlers when a player connection opens', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    const opened: string[] = []
    t.onPeerOpen(id => opened.push(id))

    const conn = mockConn('p1')
    const peer = MockPeer.lastInstance as unknown as { emit(e: string, ...a: unknown[]): void }
    peer.emit('connection', conn)
    expect(opened).toEqual([])
    conn.on.mock.calls.find((args: unknown[]) => args[0] === 'open')?.[1]?.()
    expect(opened).toEqual(['dc_p1'])
  })

  it('host: notifies close handlers with the connection id', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    const closed: string[] = []
    const unsub = t.onPeerClose(id => closed.push(id))

    const conn = mockConn('p1')
    const peer = MockPeer.lastInstance as unknown as { emit(e: string, ...a: unknown[]): void }
    peer.emit('connection', conn)
    conn.on.mock.calls.find((args: unknown[]) => args[0] === 'open')?.[1]?.()
    conn.on.mock.calls.find((args: unknown[]) => args[0] === 'close')?.[1]?.()
    expect(closed).toEqual(['dc_p1'])

    unsub()
    conn.on.mock.calls.find((args: unknown[]) => args[0] === 'close')?.[1]?.()
    expect(closed).toEqual(['dc_p1'])
  })

  it('connection: close event removes connection from map', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    MockPeer.lastInstance.emit('open')
    await connectPromise

    const conn = mockConn('p1')
    const peer = MockPeer.lastInstance as unknown as { emit(e: string, ...a: unknown[]): void }
    peer.emit('connection', conn)
    conn.on.mock.calls.find((args: unknown[]) => args[0] === 'open')?.[1]?.()

    // Connection is now stored; fire close to remove it
    conn.on.mock.calls.find((args: unknown[]) => args[0] === 'close')?.[1]?.()

    // After close, host broadcast should not reach this conn
    t.send({ type: 'BUZZER_LOCK' })
    expect(conn.send).not.toHaveBeenCalled()
  })

  it('player: send forwards event to the host connection', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_PLAYER_CONFIG)
    await Promise.resolve() // let new Peer() register handlers

    // Grab the MockDataConnection created by mock's connect() inside the 'open' handler.
    // We need to emit 'open' on the Peer first, which triggers connect() internally.
    // Intercept connect() to capture the returned MockDataConnection.
    const peer = MockPeer.lastInstance as unknown as {
      emit(e: string, ...a: unknown[]): void
      connect: (id: string) => {
        emit(e: string, ...a: unknown[]): void
        send: ReturnType<typeof vi.fn>
        on: (e: string, h: (...a: unknown[]) => void) => void
        open: boolean
      }
    }

    let capturedConn: ReturnType<typeof peer.connect> | null = null
    const origConnect = peer.connect.bind(peer)
    peer.connect = (id: string) => {
      capturedConn = origConnect(id)
      return capturedConn
    }

    peer.emit('open')

    // capturedConn is the MockDataConnection — fire its 'open' so it's stored and
    // connect() resolves
    expect(capturedConn).not.toBeNull()
    capturedConn!.emit('open')
    await connectPromise

    const event: TransportEvent = { type: 'BUZZER_UNLOCK' }
    t.send(event)

    expect(capturedConn!.send).toHaveBeenCalledWith(event)
  })

  it('rejects after timeout when peer never emits open', async () => {
    vi.useFakeTimers()
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_HOST_CONFIG)
    vi.advanceTimersByTime(8001)

    await expect(connectPromise).rejects.toThrow('PeerJS connection timeout')
    expect(t.status).toBe('disconnected')
    vi.useRealTimers()
  })
})

// ── TransportManager.tryTransport (transport/index.ts lines 64-65) ─────────────
// The existing transport.test.ts stubs out tryTransport entirely. These tests
// let it run for real using the PeerJS mock so the two lines are covered.

describe('TransportManager — tryTransport executes connect and stores transport', () => {
  it('peer mode: tryTransport runs connect and assigns transport', async () => {
    const { TransportManager } = await import('@/transport')
    const manager = new TransportManager()

    // connect() dynamically imports PeerJSTransport, adding async ticks
    // before new Peer() is called and MockPeer.lastInstance is set.
    // Clear lastInstance first so the poll loop waits for the fresh
    // instance created by this connect() call, not a stale one from a
    // prior test.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(MockPeer as any).lastInstance = null
    const connectPromise = manager.connect(PEER_HOST_CONFIG)
    while (!MockPeer.lastInstance) {
      await Promise.resolve()
    }
    MockPeer.lastInstance.emit('open')
    await connectPromise

    expect(manager.status).toBe('connected')
    expect(manager.transportType).toBe('peer')
  })
})
