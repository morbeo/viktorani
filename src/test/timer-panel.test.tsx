// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimerPanel } from '@/components/timer/TimerPanel'
import type { Timer } from '@/db'
import type { UseTimerListResult } from '@/hooks/useTimer'

vi.mock('@/components/ui', async () => {
  const actual = await vi.importActual('@/components/ui')
  return {
    ...actual,
    useToast: () => ({ addToast: vi.fn() }),
  }
})

describe('TimerPanel', () => {
  const now = Date.now()

  const timers: Timer[] = [
    {
      id: 't1',
      gameId: 'g1',
      label: 'Round 1',
      duration: 60,
      remaining: 60,
      target: 'all',
      message: '',
      visible: true,
      paused: false,
      startedAt: now - 10000,
      audioNotify: 'none',
      visualNotify: 'none',
      autoReset: 'none',
    },
    {
      id: 't2',
      gameId: 'g1',
      label: 'Bonus',
      duration: 30,
      remaining: 30,
      target: 'all',
      message: '',
      visible: true,
      paused: false,
      startedAt: null,
      audioNotify: 'none',
      visualNotify: 'none',
      autoReset: 'none',
    },
    {
      id: 't3',
      gameId: 'g1',
      label: 'Paused Timer',
      duration: 120,
      remaining: 120,
      target: 'all',
      message: '',
      visible: true,
      paused: true,
      startedAt: now - 5000,
      audioNotify: 'none',
      visualNotify: 'none',
      autoReset: 'none',
    },
  ]

  const mockHook: UseTimerListResult = {
    timers,
    createTimer: vi.fn(async opts => ({
      id: 'new',
      gameId: opts.gameId,
      label: opts.label,
      duration: opts.duration,
      remaining: opts.duration,
      target: 'all',
      message: '',
      visible: true,
      paused: false,
      startedAt: null,
      audioNotify: 'none',
      visualNotify: 'none',
      autoReset: 'none',
    })),
    startTimer: vi.fn(async () => {}),
    pauseTimer: vi.fn(async () => {}),
    resumeTimer: vi.fn(async () => {}),
    restartTimer: vi.fn(async () => {}),
    updateTimer: vi.fn(async () => {}),
    deleteTimer: vi.fn(async () => {}),
    pauseAll: vi.fn(async () => {}),
    resumeAll: vi.fn(async () => {}),
    restartAll: vi.fn(async () => {}),
    deleteAll: vi.fn(async () => {}),
    autoReset: vi.fn(async () => {}),
    remaining: vi.fn(id => {
      if (id === 't1') return 50
      if (id === 't2') return 30
      if (id === 't3') return 115
      return 0
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders timer list with count badge', () => {
    render(<TimerPanel gameId="g1" hook={mockHook} />)
    expect(screen.getByText(/Timers/i)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows empty state when no timers', () => {
    render(<TimerPanel gameId="g1" hook={{ ...mockHook, timers: [] }} />)
    expect(screen.getByText(/No active timers/i)).toBeInTheDocument()
  })

  it('renders each timer card', () => {
    render(<TimerPanel gameId="g1" hook={mockHook} />)
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByText('Bonus')).toBeInTheDocument()
    expect(screen.getByText('Paused Timer')).toBeInTheDocument()
  })

  it('shows bulk controls when multiple timers exist', () => {
    render(<TimerPanel gameId="g1" hook={mockHook} />)
    expect(screen.getByRole('button', { name: 'Pause all timers' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restart all timers' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear all timers' })).toBeInTheDocument()
  })

  it('hides bulk controls when only one timer exists', () => {
    render(<TimerPanel gameId="g1" hook={{ ...mockHook, timers: [timers[0]] }} />)
    expect(screen.queryByRole('button', { name: 'Pause all timers' })).not.toBeInTheDocument()
  })

  it('shows Resume all when all pauseable timers are paused', () => {
    const allPaused = timers.map(t => ({ ...t, paused: true, startedAt: now }))
    render(<TimerPanel gameId="g1" hook={{ ...mockHook, timers: allPaused }} />)
    expect(screen.getByRole('button', { name: 'Resume all timers' })).toBeInTheDocument()
  })

  it('opens create modal when Add timer is clicked', async () => {
    render(<TimerPanel gameId="g1" hook={mockHook} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add timer' }))
    expect(screen.getByRole('heading', { name: 'New Timer' })).toBeInTheDocument()
  })

  it('creates and starts a timer', async () => {
    render(<TimerPanel gameId="g1" hook={mockHook} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add timer' }))
    await userEvent.type(screen.getByLabelText('Label (optional)'), 'New Timer')
    await userEvent.clear(screen.getByLabelText('Min'))
    await userEvent.type(screen.getByLabelText('Min'), '0')
    await userEvent.clear(screen.getByLabelText('Sec'))
    await userEvent.type(screen.getByLabelText('Sec'), '45')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(mockHook.createTimer).toHaveBeenCalledWith({
      gameId: 'g1',
      label: 'New Timer',
      duration: 45,
    })
    expect(mockHook.startTimer).toHaveBeenCalledWith('new')
  })

  it('calls pauseAll when Pause all is clicked', async () => {
    render(<TimerPanel gameId="g1" hook={mockHook} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pause all timers' }))
    expect(mockHook.pauseAll).toHaveBeenCalled()
  })

  it('calls resumeAll when Resume all is clicked', async () => {
    const allPaused = timers.map(t => ({ ...t, paused: true, startedAt: now }))
    render(<TimerPanel gameId="g1" hook={{ ...mockHook, timers: allPaused }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Resume all timers' }))
    expect(mockHook.resumeAll).toHaveBeenCalled()
  })

  it('calls restartAll when Restart all is clicked', async () => {
    render(<TimerPanel gameId="g1" hook={mockHook} />)
    await userEvent.click(screen.getByRole('button', { name: 'Restart all timers' }))
    expect(mockHook.restartAll).toHaveBeenCalled()
  })

  it('calls deleteAll when Clear all is clicked', async () => {
    render(<TimerPanel gameId="g1" hook={mockHook} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear all timers' }))
    expect(mockHook.deleteAll).toHaveBeenCalled()
  })
})
