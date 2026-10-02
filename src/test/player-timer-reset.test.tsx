// @vitest-pool vmForks
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { TransportEvent } from '@/transport/types'
import { PlayerTimers } from '@/pages/player/Play'

const captured = vi.hoisted(() => ({ handler: null as ((e: TransportEvent) => void) | null }))

vi.mock('@/transport', () => ({ transportManager: { send: vi.fn() } }))
vi.mock('@/hooks/useTransport', () => ({
  useTransportEvents: (h: (e: TransportEvent) => void) => {
    captured.handler = h
  },
}))

function emit(event: TransportEvent) {
  act(() => captured.handler?.(event))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PlayerTimers — TIMER_START', () => {
  it('picks up a timer that was already running when the player joined', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    render(<PlayerTimers />)
    emit({ type: 'TIMER_START', id: 't1', duration: 60, label: 'Q', remaining: 15 })
    expect(screen.getByText('00:15')).toBeInTheDocument()
  })
})

describe('PlayerTimers — TIMER_RESET (#285)', () => {
  it('resets a running timer to its full duration, paused', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    render(<PlayerTimers />)

    emit({ type: 'TIMER_START', id: 't1', duration: 60, label: 'Q' })
    now.mockReturnValue(1_045_000)
    emit({ type: 'TIMER_RESET', id: 't1', duration: 60 })
    // A reset timer is paused and hidden until the host resumes it
    expect(screen.queryByText(/\d\d:\d\d/)).toBeNull()

    emit({ type: 'TIMER_RESUME', id: 't1' })
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })
})
