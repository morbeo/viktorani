import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  parseStudio,
  programPhase,
  readStudio,
  screenSpeed,
  screenTransition,
  subscribeStudio,
  take,
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
    expect(screenTransition('reveal', { program: 'reveal', transition: 'zoom' })).toBe('zoom')
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
    expect(parseStudio(JSON.stringify({ program: 'reveal', transition: 'spin' }))).toEqual({
      program: 'reveal',
      transition: 'cut',
    })
    expect(
      parseStudio(
        JSON.stringify({
          program: 'reveal',
          transition: 'wipe',
          speed: 'warp',
          pick: { transition: 'cut', speed: 'slow' },
        })
      )
    ).toStrictEqual({ program: 'reveal', transition: 'wipe' })
  })

  it('keeps the speed of the take and the pick', () => {
    const state = {
      program: 'reveal',
      transition: 'dip',
      speed: 'slow',
      pick: { transition: 'zoom', speed: 'short' },
    } as const
    expect(parseStudio(JSON.stringify(state))).toEqual(state)
    expect(
      parseStudio(JSON.stringify({ ...state, pick: { transition: 'slide', speed: 'nope' } }))?.pick
    ).toEqual({ transition: 'slide', speed: 'normal' })
  })
})

describe('screenSpeed', () => {
  it("plays the take's speed only for the phase it put on air, and only when animated", () => {
    const slow = { program: 'reveal', transition: 'slide', speed: 'slow' } as const
    expect(screenSpeed('reveal', slow)).toBe('slow')
    expect(screenSpeed('reveal', { program: 'reveal', transition: 'fade' })).toBe('normal')
    expect(screenSpeed('lobby', slow)).toBe('normal')
    expect(screenSpeed('reveal', { ...slow, transition: 'cut' })).toBe('normal')
    expect(screenSpeed('reveal', null)).toBe('normal')
  })
})

describe('take', () => {
  it('puts the live phase on air, keeping the pick and dropping a normal or cut speed', () => {
    const pick = { transition: 'wipe', speed: 'slow' } as const
    const studio = { program: 'question', transition: 'cut', pick } as const
    expect(take('reveal', studio, 'wipe', 'slow')).toEqual({
      program: 'reveal',
      transition: 'wipe',
      speed: 'slow',
      pick,
    })
    expect(take('reveal', studio, 'fade')).toStrictEqual({
      program: 'reveal',
      transition: 'fade',
      pick,
    })
    expect(take('reveal', null, 'cut', 'slow')).toStrictEqual({
      program: 'reveal',
      transition: 'cut',
    })
  })
})
