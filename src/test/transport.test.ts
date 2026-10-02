import { describe, it, expect, vi, beforeEach } from 'vitest'
import { describeTransportError, generateRoomId, retry, TransportManager } from '@/transport'
import type {
  ITransport,
  TransportConfig,
  TransportEvent,
  TransportStatus,
  TransportType,
} from '@/transport/types'

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

function makeMockTransport(type: 'peer', fails = false): ITransport {
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
    sendTo: vi.fn(),
    onEvent: vi.fn(h => {
      handlers.push(h)
      return () => {}
    }),
    onPeerOpen: vi.fn(() => () => {}),
    onPeerClose: vi.fn(() => () => {}),
    onStatusChange: vi.fn(() => () => {}),
    // expose for testing
    _emit: (e: TransportEvent) => handlers.forEach(h => h(e)),
  } as unknown as ITransport
}

const BASE_CONFIG: TransportConfig = {
  role: 'host',
  roomId: 'ABC123',
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

  describe('connect', () => {
    it('uses the PeerJS transport', async () => {
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect(BASE_CONFIG)
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

  describe('connect — failure', () => {
    it('rejects and reports the error when PeerJS fails (no fallback)', async () => {
      const spy = vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        throw Object.assign(new Error('peer failed'), { type: 'unavailable-id' })
      })
      const listener = vi.fn()
      manager.onStatusChange(listener)
      await expect(manager.connect(BASE_CONFIG)).rejects.toThrow('peer failed')
      expect(spy).toHaveBeenCalledTimes(1)
      expect(manager.status).toBe('error')
      expect(manager.error).toBe('This room is already open in another tab or on another device.')
      expect(listener).toHaveBeenLastCalledWith('error', null)

      await manager.disconnect()
      expect(manager.status).toBe('idle')
      expect(manager.error).toBeNull()
    })

    it('stays idle when the connect is cancelled', async () => {
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        throw new DOMException('Transport connect cancelled', 'AbortError')
      })
      await expect(manager.connect(BASE_CONFIG)).rejects.toMatchObject({ name: 'AbortError' })
      expect(manager.status).toBe('idle')
      expect(manager.error).toBeNull()
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
      expect(mock.send).toHaveBeenCalledWith(event, undefined)
    })

    it('passes the broadcast filter to the transport until it is cleared', () => {
      const mock = makeMockTransport('peer')
      internals(manager).transport = mock
      const admitted = (connId: string) => connId === 'dc_1'
      manager.setBroadcastFilter(admitted)
      manager.send({ type: 'BUZZER_LOCK' })
      expect(mock.send).toHaveBeenLastCalledWith({ type: 'BUZZER_LOCK' }, admitted)

      manager.setBroadcastFilter(null)
      manager.send({ type: 'BUZZER_UNLOCK' })
      expect(mock.send).toHaveBeenLastCalledWith({ type: 'BUZZER_UNLOCK' }, undefined)
    })

    it('is a no-op when not connected', () => {
      expect(() => manager.send({ type: 'BUZZER_LOCK' })).not.toThrow()
    })
  })

  describe('sendToAll', () => {
    it('ignores the broadcast filter', () => {
      const mock = makeMockTransport('peer')
      internals(manager).transport = mock
      manager.setBroadcastFilter(() => false)
      const event: TransportEvent = { type: 'JOIN_PENDING' }
      manager.sendToAll(event)
      expect(mock.send).toHaveBeenCalledWith(event)
    })
  })

  describe('sendTo', () => {
    it('delegates to the active transport with the connection id', () => {
      const mock = makeMockTransport('peer')
      internals(manager).transport = mock
      const event: TransportEvent = { type: 'JOIN_PENDING' }
      manager.sendTo('dc_1', event)
      expect(mock.sendTo).toHaveBeenCalledWith('dc_1', event)
    })

    it('is a no-op when not connected', () => {
      expect(() => manager.sendTo('dc_1', { type: 'JOIN_PENDING' })).not.toThrow()
    })
  })

  describe('onPeerOpen', () => {
    it('forwards connection opens from the transport', async () => {
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect(BASE_CONFIG)

      const opened: string[] = []
      const unsub = manager.onPeerOpen(id => opened.push(id))
      const captured = (mock.onPeerOpen as ReturnType<typeof vi.fn>).mock.calls[0][0]
      captured('dc_1')
      unsub()
      captured('dc_2')

      expect(opened).toEqual(['dc_1'])
    })
  })

  describe('onPeerClose', () => {
    it('forwards connection closes from the transport', async () => {
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect(BASE_CONFIG)

      const closed: string[] = []
      const unsub = manager.onPeerClose(id => closed.push(id))
      const captured = (mock.onPeerClose as ReturnType<typeof vi.fn>).mock.calls[0][0]
      captured('dc_1')
      unsub()
      captured('dc_2')

      expect(closed).toEqual(['dc_1'])
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

    it('passes the sending connection id to handlers', async () => {
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect(BASE_CONFIG)

      const handler = vi.fn()
      manager.onEvent(handler)
      const capturedHandler = (mock.onEvent as ReturnType<typeof vi.fn>).mock.calls[0][0]
      capturedHandler({ type: 'BUZZ', timestamp: 1 }, 'dc_7')

      expect(handler).toHaveBeenCalledWith({ type: 'BUZZ', timestamp: 1 }, 'dc_7')
    })

    it('drops events that fail the message contract in production', async () => {
      vi.stubEnv('DEV', false)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect(BASE_CONFIG)

      const handler = vi.fn()
      manager.onEvent(handler)
      const capturedHandler = (mock.onEvent as ReturnType<typeof vi.fn>).mock.calls[0][0]
      capturedHandler({ type: 'SLIDE_CHANGE', idx: 2, roundIndex: 0 })

      expect(handler).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledOnce()
      vi.unstubAllEnvs()
      warn.mockRestore()
    })

    it('throws on events that fail the message contract in development', async () => {
      vi.stubEnv('DEV', true)
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect(BASE_CONFIG)

      const capturedHandler = (mock.onEvent as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(() => capturedHandler({ type: 'BUZZ', playerId: 'p1' })).toThrow(/invalid event/i)
      vi.unstubAllEnvs()
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

    it('forwards status changes after connecting, with a readable error', async () => {
      const mock = makeMockTransport('peer')
      vi.spyOn(internals(manager), 'tryTransport').mockImplementation(async () => {
        internals(manager).transport = mock
      })
      await manager.connect(BASE_CONFIG)
      const listener = vi.fn()
      manager.onStatusChange(listener)
      const forward = (mock.onStatusChange as ReturnType<typeof vi.fn>).mock.calls[0][0] as (
        s: TransportStatus,
        e: unknown
      ) => void

      forward('disconnected', Object.assign(new Error('Lost'), { type: 'network' }))
      expect(listener).toHaveBeenCalledTimes(1)
      expect(manager.error).toBe(
        'Cannot reach the connection server. Check your internet connection.'
      )

      forward('connected', null)
      expect(listener).toHaveBeenCalledTimes(2)
      expect(manager.error).toBeNull()
    })
  })
})

describe('describeTransportError', () => {
  it('explains the PeerJS error types a user can act on', () => {
    expect(describeTransportError({ type: 'peer-unavailable' })).toMatch(/host is not online/)
    expect(describeTransportError({ type: 'socket-closed' })).toMatch(/connection server/)
    expect(describeTransportError(new Error('PeerJS connection timeout'))).toMatch(/Timed out/)
  })

  it('falls back to a generic sentence', () => {
    expect(describeTransportError(new Error('???'))).toBe('The connection failed.')
    expect(describeTransportError(null)).toBe('The connection failed.')
  })
})

describe('retry', () => {
  it('retries after each delay until the attempt succeeds', async () => {
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('one'))
      .mockRejectedValueOnce(new Error('two'))
      .mockResolvedValue('ok')
    const onRetry = vi.fn()
    await expect(retry(attempt, { delays: [0, 0, 0], onRetry })).resolves.toBe('ok')
    expect(attempt).toHaveBeenCalledTimes(3)
    expect(onRetry.mock.calls).toEqual([[1], [2]])
  })

  it('rejects with the last error once the delays are used up', async () => {
    const attempt = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('down'))
    await expect(retry(attempt, { delays: [0] })).rejects.toThrow('down')
    expect(attempt).toHaveBeenCalledTimes(2)
  })

  it('stops at once on an AbortError or when cancelled', async () => {
    const aborted = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    await expect(retry(aborted, { delays: [0] })).rejects.toMatchObject({ name: 'AbortError' })
    expect(aborted).toHaveBeenCalledTimes(1)

    const failing = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('down'))
    await expect(retry(failing, { delays: [0], cancelled: () => true })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(failing).toHaveBeenCalledTimes(1)
  })
})
