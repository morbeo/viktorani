// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTransport, useTransportEvents } from '@/hooks/useTransport'
import type { TransportStatus, TransportType } from '@/transport/types'

const mockManager = {
  status: 'idle' as TransportStatus,
  transportType: null as TransportType,
  send: vi.fn(),
  onStatusChange: vi.fn(() => vi.fn()),
  onEvent: vi.fn(() => vi.fn()),
}

vi.mock('@/transport', () => ({
  transportManager: mockManager,
}))

describe('useTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockManager.status = 'idle'
    mockManager.transportType = null
  })

  it('returns initial status and type', () => {
    const { result } = renderHook(() => useTransport())
    expect(result.current.status).toBe('idle')
    expect(result.current.type).toBe(null)
  })

  it('subscribes to status changes', () => {
    renderHook(() => useTransport())
    expect(mockManager.onStatusChange).toHaveBeenCalled()
  })

  it('updates status when transport status changes', () => {
    let statusCallback: ((s: TransportStatus, t: TransportType) => void) | null = null
    mockManager.onStatusChange.mockImplementation((cb: (s: TransportStatus, t: TransportType) => void) => {
      statusCallback = cb
      return vi.fn()
    })

    const { result } = renderHook(() => useTransport())
    expect(result.current.status).toBe('idle')

    act(() => {
      statusCallback?.('connected', 'peer')
    })

    expect(result.current.status).toBe('connected')
    expect(result.current.type).toBe('peer')
  })

  it('provides a stable send function', () => {
    const { result, rerender } = renderHook(() => useTransport())
    const firstSend = result.current.send
    rerender()
    expect(result.current.send).toBe(firstSend)
  })

  it('sends events through transport manager', () => {
    const { result } = renderHook(() => useTransport())
    const event = { type: 'BUZZ' as const, timestamp: 123 }
    act(() => {
      result.current.send(event)
    })
    expect(mockManager.send).toHaveBeenCalledWith(event)
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    mockManager.onStatusChange.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useTransport())
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})

describe('useTransportEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subscribes to transport events', () => {
    const handler = vi.fn()
    renderHook(() => useTransportEvents(handler))
    expect(mockManager.onEvent).toHaveBeenCalledWith(handler)
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    mockManager.onEvent.mockReturnValue(unsubscribe)

    const handler = vi.fn()
    const { unmount } = renderHook(() => useTransportEvents(handler))
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('re-subscribes when handler changes', () => {
    const unsubscribe1 = vi.fn()
    const unsubscribe2 = vi.fn()
    mockManager.onEvent.mockReturnValueOnce(unsubscribe1).mockReturnValueOnce(unsubscribe2)

    const handler1 = vi.fn()
    const { rerender } = renderHook(({ h }) => useTransportEvents(h), {
      initialProps: { h: handler1 },
    })

    const handler2 = vi.fn()
    rerender({ h: handler2 })

    expect(unsubscribe1).toHaveBeenCalled()
    expect(mockManager.onEvent).toHaveBeenCalledWith(handler2)
  })
})
