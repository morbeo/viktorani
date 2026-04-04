import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePassphrase, generateRoomId, TransportManager } from '@/transport'
import type {
  ITransport,
  TransportConfig,
  TransportEvent,
  TransportStatus,
  TransportType,
} from '@/transport/types'

// ── generatePassphrase ────────────────────────────────────────────────────────

describe('generatePassphrase', () => {
  it('returns 4 words by default', () => {
    const p = generatePassphrase()
    expect(p.split('-')).toHaveLength(4)
  })

  it('honours wordCount parameter', () => {
    expect(generatePassphrase(2).split('-')).toHaveLength(2)
    expect(generatePassphrase(6).split('-')).toHaveLength(6)
  })

  it('contains only lowercase words from the wordlist', () => {
    for (let i = 0; i < 20; i++) {
      const words = generatePassphrase().split('-')
      words.forEach(w => expect(w).toMatch(/^[a-z]+$/))
    }
  })

  it('generates different values on successive calls', () => {
    const phrases = new Set(Array.from({ length: 20 }, () => generatePassphrase()))
    expect(phrases.size).toBeGreaterThan(1)
  })
})

// ── generateRoomId ────────────────────────────────────────────────────────────

describe('generateRoomId', () => {
  it('returns a 6-character string', () => {
    expect(generateRoomId()).toHaveLength(6)
  })

  it('is uppercase alphanumeric', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateRoomId()).toMatch(/^[A-Z0-9]+$/)
    }
  })

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateRoomId()))
    expect(ids.size).toBeGreaterThan(40)
  })
})

// ── TransportManager ──────────────────────────────────────────────────────────

function makeMockTransport(type: 'peer' | 'gun', fails = false): ITransport {
  const handlers: Array<(e: TransportEvent) => void> = []
  return {
    get status() {
      return fails ? ('error' as const) : ('connected' as const)
    },
    get transportType() {
      return type
    },
    connect: vi.fn(async () => {
      if (fails) throw new Error('connect failed')
    }),
    disconnect: vi.fn(),
    send: vi.fn(),
    onEvent: vi.fn(h => {
      handlers.push(h)
      return () => {}
    }),
    // expose for testing
    _emit: (e: TransportEvent) => handlers.forEach(h => h(e)),
  } as unknown as ITransport
}

const BASE_CONFIG: TransportConfig = {
  mode: 'peer',
  role: 'host',
  roomId: 'ABC123',
  passphrase: 'a-b-c-d',
}

describe('TransportManager', () => {
  let manager: TransportManager

  beforeEach(() => {
    manager = new TransportManager()
  })

  describe('initial state', () => {
    it('starts idle with no transport type', () => {
      expect(manager.status).toBe('idle')
      expect(manager.transportType).toBeNull()
    })
  })

  // Helper: access private members without any
  function internals(m: TransportManager) {
    return m as unknown as {
      transport: unknown
      tryTransport(t: unknown, cfg: unknown): Promise<void>
      eventHandlers: Array<(e: TransportEvent) => void>
      statusListeners: Array<(s: TransportStatus, t: TransportType) => void>
    }
  }

  describe('connect — peer mode', () => {
    it('uses PeerJS transport when mode is peer', async () => {
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect({ ...BASE_CONFIG, mode: 'peer' })
      expect(manager.transportType).toBe('peer')
    })

    it('notifies status listeners on connect', async () => {
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      const listener = vi.fn()
      manager.onStatusChange(listener)
      await manager.connect(BASE_CONFIG)
      expect(listener).toHaveBeenCalledWith('connected', 'peer')
    })
  })

  describe('connect — gun mode', () => {
    it('uses Gun transport when mode is gun', async () => {
      const mock = makeMockTransport('gun')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect({ ...BASE_CONFIG, mode: 'gun' })
      expect(manager.transportType).toBe('gun')
    })
  })

  describe('connect — auto mode', () => {
    it('uses PeerJS when it succeeds', async () => {
      const peer = makeMockTransport('peer')
      const gun = makeMockTransport('gun')
      let calls = 0
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = calls++ === 0 ? peer : gun
      })
      await manager.connect({ ...BASE_CONFIG, mode: 'auto' })
      expect(calls).toBe(1)
      expect(manager.transportType).toBe('peer')
    })

    it('falls back to Gun when PeerJS fails', async () => {
      const gun = makeMockTransport('gun')
      let calls = 0
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        if (calls++ === 0) throw new Error('peer failed')
        internals(manager).transport = gun
      })
      await manager.connect({ ...BASE_CONFIG, mode: 'auto' })
      expect(calls).toBe(2)
      expect(manager.transportType).toBe('gun')
    })
  })

  describe('disconnect', () => {
    it('resets to idle', async () => {
      const mock = makeMockTransport('peer')
      internals(manager).transport = mock
      await manager.disconnect()
      expect(manager.status).toBe('idle')
      expect(manager.transportType).toBeNull()
      expect(mock.disconnect).toHaveBeenCalled()
    })

    it('notifies status listeners', async () => {
      const listener = vi.fn()
      manager.onStatusChange(listener)
      await manager.disconnect()
      expect(listener).toHaveBeenCalledWith('idle', null)
    })

    it('is safe to call when not connected', async () => {
      await expect(manager.disconnect()).resolves.toBeUndefined()
    })
  })

  describe('send', () => {
    it('delegates to the active transport', () => {
      const mock = makeMockTransport('peer')
      internals(manager).transport = mock
      const event: TransportEvent = { type: 'BUZZER_LOCK' }
      manager.send(event)
      expect(mock.send).toHaveBeenCalledWith(event)
    })

    it('is a no-op when not connected', () => {
      expect(() => manager.send({ type: 'BUZZER_LOCK' })).not.toThrow()
    })
  })

  describe('onEvent', () => {
    it('receives events forwarded from the transport', async () => {
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect(BASE_CONFIG)

      const received: TransportEvent[] = []
      manager.onEvent(e => received.push(e))

      // Simulate the transport emitting an event
      const event: TransportEvent = { type: 'SLIDE_CHANGE', index: 2, roundIndex: 0 }
      const capturedHandler = (mock.onEvent as ReturnType<typeof vi.fn>).mock.calls[0][0]
      capturedHandler(event)

      expect(received).toHaveLength(1)
      expect(received[0]).toEqual(event)
    })

    it('returns an unsubscribe function', () => {
      const handler = vi.fn()
      const unsub = manager.onEvent(handler)
      unsub()
      // After unsubscribing, handler should not be in the list
      expect(internals(manager).eventHandlers).not.toContain(handler)
    })
  })

  describe('onStatusChange', () => {
    it('returns an unsubscribe function that removes the listener', () => {
      const listener = vi.fn()
      const unsub = manager.onStatusChange(listener)
      unsub()
      expect(internals(manager).statusListeners).not.toContain(listener)
    })

    it('can register multiple listeners', async () => {
      const a = vi.fn()
      const b = vi.fn()
      manager.onStatusChange(a)
      manager.onStatusChange(b)
      await manager.disconnect()
      expect(a).toHaveBeenCalled()
      expect(b).toHaveBeenCalled()
    })
  })
})
