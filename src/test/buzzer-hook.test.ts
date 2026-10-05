// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn(), disconnect: vi.fn() },
}))

import { db } from '@/db'
import { transportManager } from '@/transport'
import { useBuzzer } from '@/hooks/useBuzzer'
import { useGameLifecycle } from '@/hooks/useGameLifecycle'
import type { BuzzEvent, Game, Player, Question } from '@/db'

const mockSend = transportManager.send as MockedFunction<typeof transportManager.send>

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    name: 'Test Game',
    status: 'active',
    roomId: 'ROOM1',
    visibility: {
      players: { showQuestion: true, showAnswers: false, showMedia: true },
      screen: { showQuestion: true, showAnswers: false, showMedia: true },
    },
    maxTeams: 0,
    maxPerTeam: 0,
    allowIndividual: true,
    allowLateJoin: true,
    allowRejoin: true,
    requireApproval: false,
    allowPlayerTeams: true,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: true,
    scoringEnabled: true,
    buzzerEnabled: true,
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
  presence: 'connected',
  deviceId: 'd1',
  joinedAt: 0,
  notes: '',
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

/** Renders useBuzzer with `game` held in state, merging patches as GameMaster does. */
function renderBuzzer(initial: Game) {
  const onGameChange = vi.fn()
  let game = initial
  const applyPatch = (patch: Partial<Game>) => {
    game = { ...game, ...patch }
    hook.rerender({ game })
  }
  const hook = renderHook(
    ({ game }: { game: Game }) =>
      useBuzzer(game, 'q1', patch => {
        onGameChange(patch)
        applyPatch(patch)
      }),
    { initialProps: { game: initial } }
  )
  return { ...hook, onGameChange, applyPatch, getGame: () => game }
}

async function buzz(result: { current: ReturnType<typeof useBuzzer> }) {
  await act(() =>
    result.current.handleIncomingBuzz({
      playerId: 'p1',
      playerName: 'Alice',
      teamId: null,
      timestamp: 1,
      receivedAt: 1,
    })
  )
}

beforeEach(async () => {
  mockSend.mockClear()
  await Promise.all([
    db.games.clear(),
    db.players.clear(),
    db.teams.clear(),
    db.buzzEvents.clear(),
    db.scoreEvents.clear(),
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

describe('overlapping lock and pause (#282)', () => {
  it('a lock toggle while a pause is being written does not revert the pause', async () => {
    const game = makeGame({ buzzerLocked: true, status: 'active' })
    await db.games.add(game)
    const { result, applyPatch, getGame } = renderBuzzer(game)
    const lifecycle = renderHook(() => useGameLifecycle()).result.current

    await act(async () => {
      const pausing = lifecycle.pauseGame(getGame())
      await result.current.toggleLock()
      applyPatch(await pausing)
    })

    expect(getGame()).toMatchObject({ status: 'paused', buzzerLocked: false })
    expect(result.current.isLocked).toBe(false)
    expect(await db.games.get('g1')).toMatchObject({ status: 'paused', buzzerLocked: false })
  })

  it('a pause landing while a lock toggle is being written does not revert the lock', async () => {
    const game = makeGame({ buzzerLocked: false, status: 'active' })
    await db.games.add(game)
    const { result, applyPatch, getGame } = renderBuzzer(game)
    const lifecycle = renderHook(() => useGameLifecycle()).result.current
    const before = getGame()

    await act(async () => {
      const locking = result.current.toggleLock()
      applyPatch(await lifecycle.pauseGame(before))
      await locking
    })

    expect(getGame()).toMatchObject({ status: 'paused', buzzerLocked: true })
    expect(result.current.isLocked).toBe(true)
    expect(await db.games.get('g1')).toMatchObject({ status: 'paused', buzzerLocked: true })
  })
})

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

  it("adds the points to the player's team as well", async () => {
    const game = makeGame({ buzzerLocked: false })
    await Promise.all([
      db.games.add(game),
      db.players.add({ ...player, teamId: 't1' }),
      db.teams.add({
        id: 't1',
        gameId: 'g1',
        name: 'Owls',
        color: '#000',
        icon: 'Zap',
        score: 4,
        notes: '',
      }),
      db.questions.add({ ...question, difficulty: null }),
    ])
    const { result } = renderBuzzer(game)

    await buzz(result)
    await act(() => result.current.adjudicate(result.current.buzzes[0].id, 'Correct'))

    expect((await db.teams.get('t1'))?.score).toBe(5)
    expect(mockSend).toHaveBeenCalledWith({ type: 'SCORE_UPDATE', scores: { p1: 1, t1: 5 } })
    const logged = await db.scoreEvents.toArray()
    const correct = { reason: 'correct', questionId: 'q1', gameId: 'g1' }
    expect(logged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ...correct, targetId: 'p1', kind: 'player', from: 0, to: 1 }),
        expect.objectContaining({ ...correct, targetId: 't1', kind: 'team', from: 4, to: 5 }),
      ])
    )
    expect(logged).toHaveLength(2)
  })

  it('GAME_STATE after a correct answer has the new player and team scores (#292)', async () => {
    const game = makeGame({ buzzerLocked: false })
    await Promise.all([
      db.games.add(game),
      db.players.add({ ...player, teamId: 't1' }),
      db.teams.add({
        id: 't1',
        gameId: 'g1',
        name: 'Owls',
        color: '#000',
        icon: 'Zap',
        score: 4,
        notes: '',
      }),
      db.questions.add({ ...question, difficulty: null }),
    ])
    const { result } = renderBuzzer(game)
    const lifecycle = renderHook(() => useGameLifecycle()).result.current

    await buzz(result)
    await act(() => result.current.adjudicate(result.current.buzzes[0].id, 'Correct'))
    await act(() => lifecycle.endGame(game))

    const sent = mockSend.mock.calls.map(([m]) => m)
    // The snapshot matches the latest SCORE_UPDATE, teams included
    expect(sent.findLast(m => m.type === 'SCORE_UPDATE')).toEqual({
      type: 'SCORE_UPDATE',
      scores: { p1: 1, t1: 5 },
    })
    expect(sent.find(m => m.type === 'GAME_STATE')).toMatchObject({
      state: { status: 'ended', scores: { p1: 1, t1: 5 } },
    })
  })
})

// ── Buzz order (#275) ─────────────────────────────────────────────────────────

describe('useBuzzer buzz order (#275)', () => {
  it('orders buzzes by host receive time, whatever the phones report', async () => {
    const game = makeGame({ buzzerLocked: false })
    await db.games.add(game)
    const { result } = renderBuzzer(game)
    const incoming = (playerId: string, timestamp: number, receivedAt: number) =>
      act(() =>
        result.current.handleIncomingBuzz({
          playerId,
          playerName: playerId,
          teamId: null,
          timestamp,
          receivedAt,
        })
      )

    // A phone with a slow clock, and one claiming time zero, both arrived later
    await incoming('p1', 5_000, 10)
    await incoming('p2', 0, 30)
    await incoming('p3', 1_000, 20)

    expect(result.current.buzzes.map(b => b.playerId)).toEqual(['p1', 'p3', 'p2'])
    expect((await db.buzzEvents.toArray()).find(b => b.playerId === 'p2')?.timestamp).toBe(0)
  })
})

// ── Buzz history (#251) ───────────────────────────────────────────────────────

describe('useBuzzer buzz history (#251)', () => {
  const stored = (overrides: Partial<BuzzEvent>): BuzzEvent => ({
    id: 'b1',
    gameId: 'g1',
    questionId: 'q1',
    playerId: 'p1',
    playerName: 'Alice',
    teamId: null,
    timestamp: 1,
    receivedAt: 1,
    isFalseStart: false,
    gmDecision: null,
    decidedAt: null,
    ...overrides,
  })

  it('loads stored buzzes for the current game and question, including after navigating back', async () => {
    await db.buzzEvents.bulkAdd([
      stored({ id: 'b1' }),
      stored({ id: 'b2', questionId: 'q2' }),
      stored({ id: 'other-game', gameId: 'g2' }),
    ])
    const game = makeGame()
    const { result, rerender } = renderHook(({ q }: { q: string }) => useBuzzer(game, q), {
      initialProps: { q: 'q1' },
    })
    await waitFor(() => expect(result.current.buzzes.map(b => b.id)).toEqual(['b1']))

    rerender({ q: 'q2' })
    await waitFor(() => expect(result.current.buzzes.map(b => b.id)).toEqual(['b2']))

    rerender({ q: 'q1' })
    await waitFor(() => expect(result.current.buzzes.map(b => b.id)).toEqual(['b1']))
  })

  it("clearBuzzes only deletes the current game's buzzes", async () => {
    await db.buzzEvents.bulkAdd([stored({ id: 'b1' }), stored({ id: 'other-game', gameId: 'g2' })])
    const { result } = renderHook(() => useBuzzer(makeGame(), 'q1'))
    await waitFor(() => expect(result.current.buzzes).toHaveLength(1))

    await act(() => result.current.clearBuzzes('q1'))

    expect(result.current.buzzes).toHaveLength(0)
    expect(await db.buzzEvents.get('b1')).toBeUndefined()
    expect(await db.buzzEvents.get('other-game')).toBeDefined()
  })
})
