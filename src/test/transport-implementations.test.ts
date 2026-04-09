// Transport implementation smoke tests — GunTransport and PeerJSTransport.
// Both depend on live network globals (Gun.js / PeerJS). We mock those globals
// so the class logic can be exercised without any real WebRTC or relay
// connection. No `any` casts — types are threaded through properly.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TransportConfig, TransportEvent } from '@/transport/types'

// ── GunTransport ──────────────────────────────────────────────────────────────
//
// Gun and SEA are injected as globals at runtime. We set them on `globalThis`
// before importing GunTransport.

type GunNode = {
  get(key: string): GunNode
  put(val: string): void
  map(): GunNode
  on(cb: (data: string, key: string) => void): GunNode
  _: { get: string }
}

type GunInstance = { get(key: string): GunNode; off(): void }

function makeGunMocks() {
  // Capture the `on` callback so tests can simulate incoming messages
  let capturedOnCb: ((data: string, key: string) => void) | null = null

  const mockNode: GunNode = {
    get: vi.fn().mockReturnThis(),
    put: vi.fn(),
    map: vi.fn().mockReturnThis(),
    on: vi.fn((cb: (data: string, key: string) => void) => {
      capturedOnCb = cb
      return mockNode
    }),
    _: { get: 'viktorani:ROOM1' },
  }

  const mockGun: GunInstance = {
    get: vi.fn().mockReturnValue(mockNode),
    off: vi.fn(),
  }

  const GunConstructor = vi.fn(() => mockGun)

  const SEA = {
    pair: vi.fn().mockResolvedValue({}),
    work: vi.fn().mockResolvedValue('shared-secret'),
    encrypt: vi.fn().mockImplementation((data: string) => Promise.resolve(`enc:${data}`)),
    decrypt: vi.fn().mockImplementation((data: string) => {
      const stripped = data.startsWith('enc:') ? data.slice(4) : null
      return Promise.resolve(stripped)
    }),
  }

  return { GunConstructor, SEA, mockGun, mockNode, getOnCb: () => capturedOnCb }
}

const GUN_CONFIG: TransportConfig = {
  mode: 'gun',
  role: 'host',
  roomId: 'ROOM1',
  passphrase: 'alpha-beta-gamma-delta',
}

describe('GunTransport', () => {
  let mocks: ReturnType<typeof makeGunMocks>

  beforeEach(async () => {
    mocks = makeGunMocks()
    // Inject globals before each test (module is re-imported fresh)
    Object.assign(globalThis, { Gun: mocks.GunConstructor, SEA: mocks.SEA })
  })

  it('starts in idle status', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    expect(t.status).toBe('idle')
    expect(t.transportType).toBe('gun')
  })

  it('connects: sets status to connected and initialises Gun', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    await t.connect(GUN_CONFIG)
    expect(t.status).toBe('connected')
    expect(mocks.GunConstructor).toHaveBeenCalled()
  })

  it('calls SEA.work to derive a shared secret on connect', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    await t.connect(GUN_CONFIG)
    expect(mocks.SEA.work).toHaveBeenCalledWith(GUN_CONFIG.passphrase, GUN_CONFIG.roomId)
  })

  it('disconnect: sets status to disconnected and calls gun.off()', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    await t.connect(GUN_CONFIG)
    t.disconnect()
    expect(t.status).toBe('disconnected')
    expect(mocks.mockGun.off).toHaveBeenCalled()
  })

  it('disconnect before connect does not throw', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    expect(() => t.disconnect()).not.toThrow()
  })

  it('send encrypts and puts the event', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    await t.connect(GUN_CONFIG)
    const event: TransportEvent = { type: 'BUZZER_LOCK' }
    await t.send(event)
    expect(mocks.SEA.encrypt).toHaveBeenCalledWith(JSON.stringify(event), 'shared-secret')
    expect(mocks.mockNode.put).toHaveBeenCalled()
  })

  it('send is a no-op when not connected', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    await expect(t.send({ type: 'BUZZER_LOCK' })).resolves.toBeUndefined()
    expect(mocks.SEA.encrypt).not.toHaveBeenCalled()
  })

  it('onEvent delivers decrypted events to registered handlers', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    await t.connect(GUN_CONFIG)

    const received: TransportEvent[] = []
    t.onEvent(e => received.push(e))

    const event: TransportEvent = { type: 'BUZZER_UNLOCK' }
    const onCb = mocks.getOnCb()
    expect(onCb).not.toBeNull()
    // Simulate an encrypted message arriving from the Gun relay
    await onCb!(`enc:${JSON.stringify(event)}`, 'some-key')

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(event)
  })

  it('onEvent ignores messages where decryption returns null', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    // Make decrypt return null for this test
    mocks.SEA.decrypt.mockResolvedValueOnce(null)
    const t = new GunTransport()
    await t.connect(GUN_CONFIG)

    const received: TransportEvent[] = []
    t.onEvent(e => received.push(e))

    const onCb = mocks.getOnCb()
    await onCb!('some-garbage', 'some-key')
    expect(received).toHaveLength(0)
  })

  it('onEvent ignores empty / falsy data', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    await t.connect(GUN_CONFIG)

    const received: TransportEvent[] = []
    t.onEvent(e => received.push(e))

    const onCb = mocks.getOnCb()
    await onCb!('', 'some-key')
    await onCb!('valid', '_') // key === '_' is skipped
    expect(received).toHaveLength(0)
  })

  it('onEvent returns an unsubscribe function', async () => {
    const { GunTransport } = await import('@/transport/GunTransport')
    const t = new GunTransport()
    const handler = vi.fn()
    const unsub = t.onEvent(handler)
    unsub()
    // Nothing to trigger here, just ensure the returned fn doesn't throw
    expect(handler).not.toHaveBeenCalled()
  })
})

// ── PeerJSTransport ───────────────────────────────────────────────────────────
//
// PeerJS is a proper npm package — we mock it with vi.mock.

vi.mock('peerjs', () => {
  type Handler = (...args: unknown[]) => void
  type EventMap = Record<string, Handler[]>

  class MockDataConnection {
    peer: string
    open = true
    private events: EventMap = {}

    constructor(peer: string) {
      this.peer = peer
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
  mode: 'peer',
  role: 'host',
  roomId: 'ROOM1',
  passphrase: 'a-b-c-d',
}

const PEER_PLAYER_CONFIG: TransportConfig = {
  mode: 'peer',
  role: 'player',
  roomId: 'ROOM1',
  passphrase: 'a-b-c-d',
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

  it('connects as player: resolves and creates a connection to host', async () => {
    const { PeerJSTransport } = await import('@/transport/PeerJSTransport')
    const t = new PeerJSTransport()

    const connectPromise = t.connect(PEER_PLAYER_CONFIG)
    MockPeer.lastInstance.emit('open')
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
    const conn1 = { peer: 'p1', open: true, send: vi.fn(), on: vi.fn(), close: vi.fn() }
    const conn2 = { peer: 'p2', open: true, send: vi.fn(), on: vi.fn(), close: vi.fn() }

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
})
