import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  parseStudio,
  programPhase,
  readStudio,
  screenTransition,
  subscribeStudio,
  writeStudio,
} from '@/lib/studio'

afterEach(() => localStorage.clear())

describe('programPhase', () => {
  it('follows the game without studio mode', () => {
    expect(programPhase('buzzed', null)).toBe('buzzed')
  })

  it('keeps the taken phase while the game runs', () => {
    expect(programPhase('buzzed', { program: 'scoreboard', transition: 'cut' })).toBe('scoreboard')
  })

  it('always shows the lobby and the end, and drops a program left at one of them', () => {
    const studio = { program: 'scoreboard', transition: 'cut' } as const
    expect(programPhase('lobby', studio)).toBe('lobby')
    expect(programPhase('ended', studio)).toBe('ended')
    expect(programPhase('question', { program: 'lobby', transition: 'cut' })).toBe('question')
  })
})

describe('screenTransition', () => {
  it('fades only the phase a fade take put on air', () => {
    const fade = { program: 'reveal', transition: 'fade' } as const
    expect(screenTransition('reveal', fade)).toBe('fade')
    expect(screenTransition('lobby', fade)).toBe('cut')
    expect(screenTransition('reveal', { ...fade, transition: 'cut' })).toBe('cut')
    expect(screenTransition('reveal', null)).toBe('cut')
  })
})

describe('studio storage', () => {
  it('keeps studio mode per game and tells subscribers', () => {
    const listener = vi.fn()
    const stop = subscribeStudio(listener)
    writeStudio('g1', { program: 'question', transition: 'fade' })
    expect(readStudio('g1')).toEqual({ program: 'question', transition: 'fade' })
    expect(readStudio('g2')).toBeNull()
    writeStudio('g1', null)
    expect(readStudio('g1')).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    writeStudio('g1', { program: 'question', transition: 'cut' })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('ignores stored values it does not understand', () => {
    expect(parseStudio('not json')).toBeNull()
    expect(parseStudio(JSON.stringify({ program: 'nope' }))).toBeNull()
    expect(parseStudio(JSON.stringify({ program: 'reveal', transition: 'wipe' }))).toEqual({
      program: 'reveal',
      transition: 'cut',
    })
  })
})
