import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { RoundBoundary } from '@/components/RoundBoundary'
import { TimerExpiredOverlay } from '@/components/timer/TimerExpiredOverlay'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RoundBoundary', () => {
  it('shows the round number and name, then hides itself', () => {
    const onDone = vi.fn()
    render(<RoundBoundary roundName="Music" roundIdx={2} onDone={onDone} />)
    expect(screen.getByText('Round 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Music' })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1599))
    expect(onDone).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Music')).not.toBeInTheDocument()
  })

  it('does not call onDone after unmounting early', () => {
    const onDone = vi.fn()
    const { unmount } = render(<RoundBoundary roundName="Music" roundIdx={0} onDone={onDone} />)
    unmount()
    act(() => vi.advanceTimersByTime(5000))
    expect(onDone).not.toHaveBeenCalled()
  })
})

describe('TimerExpiredOverlay', () => {
  it('shows the timer label unless it is the default', () => {
    const { rerender } = render(<TimerExpiredOverlay label="Round 1" onDismiss={() => {}} />)
    expect(screen.getByText("Time's up!")).toBeInTheDocument()
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    rerender(<TimerExpiredOverlay label="Timer" onDismiss={() => {}} />)
    expect(screen.queryByText('Timer')).not.toBeInTheDocument()
  })

  it('dismisses itself once the countdown runs out', () => {
    const onDismiss = vi.fn()
    render(<TimerExpiredOverlay label="" onDismiss={onDismiss} autoDismissMs={1000} />)
    act(() => vi.advanceTimersByTime(500))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(600))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('stops the countdown when unmounted', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(
      <TimerExpiredOverlay label="" onDismiss={onDismiss} autoDismissMs={1000} />
    )
    unmount()
    act(() => vi.advanceTimersByTime(2000))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses on click', () => {
    const onDismiss = vi.fn()
    render(<TimerExpiredOverlay label="" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText("Time's up!"))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it.each(['Escape', 'Enter', ' '])('dismisses on the %j key', key => {
    const onDismiss = vi.fn()
    render(<TimerExpiredOverlay label="" onDismiss={onDismiss} />)
    fireEvent.keyDown(window, { key })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    const onDismiss = vi.fn()
    render(<TimerExpiredOverlay label="" onDismiss={onDismiss} />)
    fireEvent.keyDown(window, { key: 'a' })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
