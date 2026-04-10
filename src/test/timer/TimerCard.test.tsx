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
    // remaining < duration → paused mid-run → label should be 'Paused', not 'Ready'
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
    expect(screen.getByText('Paused')).toBeTruthy()
  })

  it('calls onResume (not onStart) when ▶ clicked on a paused mid-run timer (bug #86)', () => {
    // Regression: paused timers with startedAt===null were calling onStart
    // (which resets remaining) instead of onResume (which continues from snapshot).
    const onStart = vi.fn()
    const onResume = vi.fn()
    render(
      <TimerCard
        timer={makeTimer({ paused: true, remaining: 30, startedAt: null })}
        remaining={30}
        onStart={onStart}
        onPause={noop}
        onResume={onResume}
        onRestart={noop}
        onDelete={noop}
        onEdit={noop}
      />
    )
    fireEvent.click(screen.getByTitle('Resume'))
    expect(onResume).toHaveBeenCalledOnce()
    expect(onStart).not.toHaveBeenCalled()
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
