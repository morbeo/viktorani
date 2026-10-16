import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePhaseOverride } from '@/hooks/usePhaseOverride'
import {
  autoPhase,
  effectivePhase,
  readPhaseOverride,
  subscribePhaseOverride,
  writePhaseOverride,
} from '@/lib/layout-phase'

const buzz = (gmDecision: 'Correct' | 'Incorrect' | 'Skip' | null, isFalseStart = false) => ({
  gmDecision,
  isFalseStart,
})

beforeEach(() => localStorage.clear())

describe('autoPhase', () => {
  it('is lobby before the start and ended after the end', () => {
    expect(autoPhase('waiting', [buzz(null)])).toBe('lobby')
    expect(autoPhase('ended', [buzz('Correct')])).toBe('ended')
  })

  it('is question with no buzzes, or only false starts and wrong answers', () => {
    expect(autoPhase('active', [])).toBe('question')
    expect(autoPhase('active', [buzz(null, true), buzz('Incorrect'), buzz('Skip')])).toBe(
      'question'
    )
  })

  it('is buzzed while a buzz waits for a ruling, and reveal after a correct one', () => {
    expect(autoPhase('active', [buzz('Incorrect'), buzz(null)])).toBe('buzzed')
    expect(autoPhase('paused', [buzz(null)])).toBe('buzzed')
    expect(autoPhase('active', [buzz('Correct'), buzz(null)])).toBe('reveal')
  })
})

describe('effectivePhase', () => {
  it("uses the GM's override only while the game runs", () => {
    expect(effectivePhase('question', null)).toBe('question')
    expect(effectivePhase('question', 'scoreboard')).toBe('scoreboard')
    expect(effectivePhase('lobby', 'scoreboard')).toBe('lobby')
    expect(effectivePhase('ended', 'scoreboard')).toBe('ended')
  })
})

describe('phase override store', () => {
  it('keeps a phase per game and clears it', () => {
    writePhaseOverride('g1', 'reveal')
    expect(readPhaseOverride('g1')).toBe('reveal')
    expect(readPhaseOverride('g2')).toBeNull()
    writePhaseOverride('g1', null)
    expect(readPhaseOverride('g1')).toBeNull()
  })

  it('ignores a stored value that is not a phase', () => {
    localStorage.setItem('viktorani:layout-phase:g1', 'intermission')
    expect(readPhaseOverride('g1')).toBeNull()
  })

  it('tells subscribers about changes here and in other windows', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePhaseOverride(listener)
    writePhaseOverride('g1', 'buzzed')
    window.dispatchEvent(new StorageEvent('storage'))
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    writePhaseOverride('g1', null)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('usePhaseOverride', () => {
  it('reads and sets the override for its game', () => {
    const { result } = renderHook(() => usePhaseOverride('g1'))
    expect(result.current[0]).toBeNull()
    act(() => result.current[1]('scoreboard'))
    expect(result.current[0]).toBe('scoreboard')

    // Another window on this machine changes it
    act(() => {
      localStorage.setItem('viktorani:layout-phase:g1', 'reveal')
      window.dispatchEvent(new StorageEvent('storage'))
    })
    expect(result.current[0]).toBe('reveal')
  })

  it('does nothing without a game', () => {
    const { result } = renderHook(() => usePhaseOverride(null))
    act(() => result.current[1]('scoreboard'))
    expect(result.current[0]).toBeNull()
    expect(localStorage.length).toBe(0)
  })
})
