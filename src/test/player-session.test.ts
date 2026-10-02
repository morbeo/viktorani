// @vitest-pool vmForks
import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { TransportEvent } from '@/transport/types'

const bus = vi.hoisted(() => ({ handlers: [] as Array<(e: TransportEvent) => void> }))

vi.mock('@/transport', () => ({
  transportManager: {
    onEvent: vi.fn((h: (e: TransportEvent) => void) => {
      bus.handlers.push(h)
      return () => bus.handlers.splice(bus.handlers.indexOf(h), 1)
    }),
  },
}))

import { reduceSession, startPlayerSession, usePlayerSession } from '@/pages/player/player-session'
import type { PlayerSession, QuestionContent } from '@/pages/player/player-session'

const EMPTY: PlayerSession = {
  playerId: null,
  teamId: null,
  buzzerLocked: true,
  scores: {},
  question: null,
  gameStatus: null,
  message: null,
}

function content(target: 'players' | 'screen'): QuestionContent {
  return {
    type: 'QUESTION_CONTENT',
    target,
    questionId: 'q1',
    title: 'Capital of France?',
    description: null,
    options: null,
    answer: null,
    media: null,
    mediaType: null,
  }
}

function emit(event: TransportEvent) {
  act(() => bus.handlers.forEach(h => h(event)))
}

describe('reduceSession', () => {
  it('keeps the latest host message, as a new object each time, and clears it', () => {
    const first = reduceSession(EMPTY, { type: 'MESSAGE', text: 'Hi' })
    expect(first.message).toEqual({ text: 'Hi' })
    const again = reduceSession(first, { type: 'MESSAGE', text: 'Hi' })
    expect(again.message).not.toBe(first.message)
    expect(reduceSession(again, { type: 'MESSAGE', text: null }).message).toBeNull()
  })

  it('follows the game status from GAME_STATE and GAME_STATUS', () => {
    const state = (status: string): TransportEvent => ({
      type: 'GAME_STATE',
      state: {
        gameId: 'g1',
        status,
        currentRoundIdx: 0,
        currentQuestionIdx: 0,
        buzzerLocked: true,
        visibility: {
          players: { showQuestion: true, showAnswers: false, showMedia: true },
          screen: { showQuestion: true, showAnswers: false, showMedia: true },
        },
        scores: {},
      },
    })
    let s = reduceSession(EMPTY, state('paused'))
    expect(s.gameStatus).toBe('paused')
    s = reduceSession(s, state('unknown'))
    expect(s.gameStatus).toBe('paused')
    s = reduceSession(s, { type: 'GAME_STATUS', status: 'ended' })
    expect(s.gameStatus).toBe('ended')
  })

  it('records the host-assigned player and team on JOIN_ACCEPTED', () => {
    const s = reduceSession(EMPTY, { type: 'JOIN_ACCEPTED', playerId: 'p1', teamId: 't1' })
    expect(s).toMatchObject({ playerId: 'p1', teamId: 't1' })
  })

  it('takes the lock and scores from GAME_STATE, then follows lock and score events', () => {
    let s = reduceSession(EMPTY, {
      type: 'GAME_STATE',
      state: {
        gameId: 'g1',
        status: 'active',
        currentRoundIdx: 0,
        currentQuestionIdx: 0,
        buzzerLocked: false,
        visibility: {
          players: { showQuestion: true, showAnswers: false, showMedia: true },
          screen: { showQuestion: true, showAnswers: false, showMedia: true },
        },
        scores: { p1: 3 },
      },
    })
    expect(s).toMatchObject({ buzzerLocked: false, scores: { p1: 3 } })
    s = reduceSession(s, { type: 'BUZZER_LOCK' })
    expect(s.buzzerLocked).toBe(true)
    s = reduceSession(s, { type: 'BUZZER_UNLOCK' })
    expect(s.buzzerLocked).toBe(false)
    s = reduceSession(s, { type: 'SCORE_UPDATE', scores: { p1: 5, t1: 9 } })
    expect(s.scores).toEqual({ p1: 5, t1: 9 })
  })

  it('keeps the players question until the slide changes', () => {
    let s = reduceSession(EMPTY, content('players'))
    expect(s.question?.title).toBe('Capital of France?')
    expect(reduceSession(s, content('screen'))).toBe(s)
    s = reduceSession(s, { type: 'SLIDE_CHANGE', index: 1, roundIndex: 0 })
    expect(s.question).toBeNull()
  })

  it('returns the same session for unrelated events', () => {
    expect(reduceSession(EMPTY, { type: 'JOIN_PENDING' })).toBe(EMPTY)
  })
})

describe('startPlayerSession', () => {
  it('keeps host events outside React and clears them for the next session', () => {
    startPlayerSession()
    // Arrives before any component is listening (the play screen is still loading)
    emit({ type: 'JOIN_ACCEPTED', playerId: 'p1', teamId: null })
    const { result } = renderHook(() => usePlayerSession())
    expect(result.current.playerId).toBe('p1')

    emit({ type: 'BUZZER_UNLOCK' })
    expect(result.current.buzzerLocked).toBe(false)

    act(() => startPlayerSession())
    expect(result.current).toEqual(EMPTY)
    expect(bus.handlers).toHaveLength(1)
  })
})
