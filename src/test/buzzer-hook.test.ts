// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

import { db } from '@/db'
import { transportManager } from '@/transport'
import { useBuzzer } from '@/hooks/useBuzzer'
import type { Game, Player, Question } from '@/db'

const mockSend = transportManager.send as MockedFunction<typeof transportManager.send>

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    transportMode: 'peer',
    roomId: 'ROOM1',
    passphrase: null,
    showQuestion: true,
    showAnswers: false,
    showMedia: true,
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: true,
    scoringEnabled: true,
    autoLockOnFirstCorrect: false,
    allowFalseStarts: false,
    buzzDeduplication: 'firstOnly',
    tiebreakerMode: 'serverOrder',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

const player: Player = {
  id: 'p1',
  gameId: 'g1',
  name: 'Alice',
  teamId: null,
  score: 0,
  isAway: false,
  deviceId: 'd1',
  joinedAt: 0,
}

const question: Question = {
  id: 'q1',
  title: 'Q',
  type: 'open_ended',
  options: [],
  answer: 'A',
  description: '',
  difficulty: 'hard',
  tags: [],
  media: null,
  mediaType: null,
  createdAt: 0,
  updatedAt: 0,
}

/** Renders useBuzzer with `game` held in state, as GameMaster does. */
function renderBuzzer(initial: Game) {
  const onGameChange = vi.fn()
  const hook = renderHook(
    ({ game }: { game: Game }) =>
      useBuzzer(game, 'q1', updated => {
        onGameChange(updated)
        hook.rerender({ game: updated })
      }),
    { initialProps: { game: initial } }
  )
  return { ...hook, onGameChange }
}

async function buzz(result: { current: ReturnType<typeof useBuzzer> }) {
  await act(() =>
    result.current.handleIncomingBuzz({
      playerId: 'p1',
      playerName: 'Alice',
      teamId: null,
      timestamp: 1,
    })
  )
}

beforeEach(async () => {
  mockSend.mockClear()
  await Promise.all([
    db.games.clear(),
    db.players.clear(),
    db.buzzEvents.clear(),
    db.questions.clear(),
    db.difficulties.clear(),
    db.gameQuestions.clear(),
  ])
})

// ── Lock state ────────────────────────────────────────────────────────────────

describe('useBuzzer lock state (#245)', () => {
  it('unlocking updates the game and accepts buzzes without a reload', async () => {
    const game = makeGame({ buzzerLocked: true })
    await db.games.add(game)
    const { result, onGameChange } = renderBuzzer(game)

    await act(() => result.current.toggleLock())

    expect(onGameChange).toHaveBeenLastCalledWith(expect.objectContaining({ buzzerLocked: false }))
    expect(result.current.isLocked).toBe(false)
    expect((await db.games.get('g1'))?.buzzerLocked).toBe(false)
    expect(mockSend).toHaveBeenLastCalledWith({ type: 'BUZZER_UNLOCK' })

    await buzz(result)
    expect(result.current.buzzes).toHaveLength(1)
    expect(result.current.buzzes[0].isFalseStart).toBe(false)
  })

  it('toggling twice returns to locked', async () => {
    const game = makeGame({ buzzerLocked: true })
    await db.games.add(game)
    const { result } = renderBuzzer(game)

    await act(() => result.current.toggleLock())
    await act(() => result.current.toggleLock())

    expect(result.current.isLocked).toBe(true)
    expect((await db.games.get('g1'))?.buzzerLocked).toBe(true)
    expect(mockSend.mock.calls.map(c => c[0].type)).toEqual(['BUZZER_UNLOCK', 'BUZZER_LOCK'])
  })

  it('two toggles before a re-render still alternate', async () => {
    const game = makeGame({ buzzerLocked: true })
    await db.games.add(game)
    const { result } = renderHook(() => useBuzzer(game, 'q1'))

    await act(async () => {
      const toggle = result.current.toggleLock
      await Promise.all([toggle(), toggle()])
    })

    expect(mockSend.mock.calls.map(c => c[0].type)).toEqual(['BUZZER_UNLOCK', 'BUZZER_LOCK'])
  })

  it('auto-lock after a correct answer is reflected in the game', async () => {
    const game = makeGame({ buzzerLocked: false, autoLockOnFirstCorrect: true })
    await Promise.all([db.games.add(game), db.players.add(player), db.questions.add(question)])
    const { result, onGameChange } = renderBuzzer(game)

    await buzz(result)
    await act(() => result.current.adjudicate(result.current.buzzes[0].id, 'Correct'))

    expect(onGameChange).toHaveBeenLastCalledWith(expect.objectContaining({ buzzerLocked: true }))
    expect(result.current.isLocked).toBe(true)
    expect(mockSend).toHaveBeenLastCalledWith({ type: 'BUZZER_LOCK' })
  })
})

// ── Scoring ───────────────────────────────────────────────────────────────────

describe('useBuzzer scoring (#246)', () => {
  it("awards the question's difficulty points on a correct answer", async () => {
    const game = makeGame({ buzzerLocked: false })
    await Promise.all([
      db.games.add(game),
      db.players.add(player),
      db.questions.add(question),
      db.difficulties.add({ id: 'hard', name: 'Hard', score: 15, color: '#000', order: 2 }),
    ])
    const { result } = renderBuzzer(game)

    await buzz(result)
    await act(() => result.current.adjudicate(result.current.buzzes[0].id, 'Correct'))

    expect((await db.players.get('p1'))?.score).toBe(15)
    expect(mockSend).toHaveBeenCalledWith({ type: 'SCORE_UPDATE', scores: { p1: 15 } })
  })

  it('falls back to 1 point when the question has no difficulty', async () => {
    const game = makeGame({ buzzerLocked: false })
    await Promise.all([
      db.games.add(game),
      db.players.add(player),
      db.questions.add({ ...question, difficulty: null }),
    ])
    const { result } = renderBuzzer(game)

    await buzz(result)
    await act(() => result.current.adjudicate(result.current.buzzes[0].id, 'Correct'))

    expect((await db.players.get('p1'))?.score).toBe(1)
  })

  it('awards points only once when Correct is clicked twice (#247)', async () => {
    const game = makeGame({ buzzerLocked: false })
    await Promise.all([
      db.games.add(game),
      db.players.add(player),
      db.questions.add({ ...question, difficulty: null }),
    ])
    const { result } = renderBuzzer(game)

    await buzz(result)
    const id = result.current.buzzes[0].id
    await act(() =>
      Promise.all([
        result.current.adjudicate(id, 'Correct'),
        result.current.adjudicate(id, 'Correct'),
      ])
    )

    expect((await db.players.get('p1'))?.score).toBe(1)
    expect(mockSend.mock.calls.filter(([m]) => m.type === 'SCORE_UPDATE')).toHaveLength(1)
  })

  it('ignores a second decision on an already decided buzz', async () => {
    const game = makeGame({ buzzerLocked: false })
    await Promise.all([db.games.add(game), db.players.add(player), db.questions.add(question)])
    const { result } = renderBuzzer(game)

    await buzz(result)
    const id = result.current.buzzes[0].id
    await act(() => result.current.adjudicate(id, 'Incorrect'))
    await act(() => result.current.adjudicate(id, 'Correct'))

    expect((await db.buzzEvents.get(id))?.gmDecision).toBe('Incorrect')
    expect(result.current.buzzes[0].gmDecision).toBe('Incorrect')
    expect((await db.players.get('p1'))?.score).toBe(0)
  })
})
