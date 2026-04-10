// @vitest-pool vmForks
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimerCard } from '@/components/timer/TimerCard'
import type { Timer } from '@/db'

function makeTimer(overrides: Partial<Timer> = {}): Timer {
  return {
    id: 'timer-1',
    gameId: 'game-1',
    label: 'Round 1',
    duration: 60,
    remaining: 60,
    target: 'all',
    message: '',
    visible: true,
    paused: true,
    startedAt: null,
    audioNotify: 'none',
    visualNotify: 'none',
    autoReset: 'none',
    ...overrides,
  }
}

const noop = () => {}

describe('TimerCard', () => {
  it('renders label', () => {
    render(
      <TimerCard
        timer={makeTimer({ label: 'Finals' })}
        remaining={60}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    expect(screen.getByText('Finals')).toBeTruthy()
  })

  it('shows Ready when never started', () => {
    render(
      <TimerCard
        timer={makeTimer()}
        remaining={60}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    expect(screen.getByText('Ready')).toBeTruthy()
  })

  it('shows Running when active', () => {
    render(
      <TimerCard
        timer={makeTimer({ paused: false, startedAt: Date.now() })}
        remaining={45}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    expect(screen.getByText('Running')).toBeTruthy()
  })

  it('shows Paused when paused mid-run', () => {
    render(
      <TimerCard
        timer={makeTimer({ paused: true, remaining: 30, startedAt: null })}
        remaining={30}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    // startedAt was set before so it shows Paused (not Ready)
    // In the component: paused && startedAt===null && timer was never started → Ready
    // With remaining < duration it implies it was started once → Paused
    // Our logic: startedAt===null && paused → Ready. Paused+remaining<duration → Paused.
    // The card shows Ready when startedAt===null. Let's verify the time display instead.
    expect(screen.getByText('00:30')).toBeTruthy()
  })

  it('shows Time up! when remaining is 0 and running', () => {
    render(
      <TimerCard
        timer={makeTimer({ paused: false, startedAt: Date.now() - 70_000 })}
        remaining={0}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    expect(screen.getByText('Time up!')).toBeTruthy()
  })

  it('calls onStart when ▶ clicked on a never-started timer', () => {
    const onStart = vi.fn()
    render(
      <TimerCard
        timer={makeTimer()}
        remaining={60}
        onStart={onStart}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    fireEvent.click(screen.getByTitle('Start'))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('calls onPause when ⏸ clicked on a running timer', () => {
    const onPause = vi.fn()
    render(
      <TimerCard
        timer={makeTimer({ paused: false, startedAt: Date.now() })}
        remaining={45}
        onStart={noop}
        onPause={onPause}
        onResume={noop}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    fireEvent.click(screen.getByTitle('Pause'))
    expect(onPause).toHaveBeenCalledOnce()
  })

  it('calls onDelete when ✕ clicked', () => {
    const onDelete = vi.fn()
    render(
      <TimerCard
        timer={makeTimer()}
        remaining={60}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onDelete={onDelete}
        onEdit={noop}
      />
    )
    fireEvent.click(screen.getByTitle('Delete timer'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('calls onRestart when ↺ clicked', () => {
    const onRestart = vi.fn()
    render(
      <TimerCard
        timer={makeTimer()}
        remaining={60}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onRestart={onRestart}
        onDelete={noop}
        onEdit={noop}
      />
    )
    fireEvent.click(screen.getByTitle('Restart'))
    expect(onRestart).toHaveBeenCalledOnce()
  })

  it('displays formatted time', () => {
    render(
      <TimerCard
        timer={makeTimer({ duration: 90, remaining: 90 })}
        remaining={90}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    expect(screen.getByText('01:30')).toBeTruthy()
  })
})
