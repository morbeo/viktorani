// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

import { db } from '@/db'
import { transportManager } from '@/transport'
import { useScoreboard, useScoreHistory } from '@/hooks/useScoreboard'
import type { Game, Player, Team } from '@/db'

const mockSend = transportManager.send as MockedFunction<typeof transportManager.send>

const game = { id: 'g1', scoringEnabled: true } as Game

const alice: Player = {
  id: 'p1',
  gameId: 'g1',
  name: 'Alice',
  teamId: 't1',
  score: 0,
  presence: 'connected',
  deviceId: 'd1',
  joinedAt: 0,
}

const team: Team = { id: 't1', gameId: 'g1', name: 'Owls', color: '#000', icon: 'Zap', score: 0 }

const scoreOf = (result: { current: ReturnType<typeof useScoreboard> }, id: string) =>
  result.current.entries.find(e => e.id === id)?.score

beforeEach(async () => {
  await Promise.all([
    db.players.clear(),
    db.teams.clear(),
    db.difficulties.clear(),
    db.scoreEvents.clear(),
  ])
  await Promise.all([db.players.add(alice), db.teams.add(team)])
  mockSend.mockClear()
})

describe('useScoreboard', () => {
  it('shows score changes made outside the hook (e.g. adjudication)', async () => {
    const { result } = renderHook(() => useScoreboard(game))
    await waitFor(() => expect(scoreOf(result, 't1')).toBe(0))

    await act(() => db.teams.update('t1', { score: 7 }))

    await waitFor(() => expect(scoreOf(result, 't1')).toBe(7))
  })

  it('shows players who join mid-game', async () => {
    const { result } = renderHook(() => useScoreboard(game))
    await waitFor(() => expect(result.current.entries).toHaveLength(1))

    await act(() => db.players.add({ ...alice, id: 'p2', name: 'Bob', teamId: null }))

    await waitFor(() => expect(scoreOf(result, 'p2')).toBe(0))
  })

  it('keeps a team adjustment when a player is adjusted afterwards', async () => {
    const { result } = renderHook(() => useScoreboard(game))
    await waitFor(() => expect(scoreOf(result, 't1')).toBe(0))

    await act(() => result.current.adjust('t1', 'team', 5))
    await act(() => result.current.adjust('p1', 'player', 1))

    expect((await db.teams.get('t1'))?.score).toBe(5)
    expect((await db.players.get('p1'))?.score).toBe(1)
    await waitFor(() => expect(scoreOf(result, 't1')).toBe(5))
  })

  it('broadcasts player and team scores after an adjustment', async () => {
    const { result } = renderHook(() => useScoreboard(game))
    await waitFor(() => expect(scoreOf(result, 't1')).toBe(0))

    await act(() => result.current.adjust('t1', 'team', 3))

    expect(mockSend).toHaveBeenCalledWith({ type: 'SCORE_UPDATE', scores: { p1: 0, t1: 3 } })
  })

  it('sets a score directly, logs it and broadcasts', async () => {
    const { result } = renderHook(() => useScoreboard(game, 'q1'))
    await waitFor(() => expect(scoreOf(result, 'p1')).toBe(0))

    await act(() => result.current.set('p1', 'player', 12))

    expect((await db.players.get('p1'))?.score).toBe(12)
    expect(mockSend).toHaveBeenCalledWith({ type: 'SCORE_UPDATE', scores: { p1: 12, t1: 0 } })
    expect(await db.scoreEvents.toArray()).toEqual([
      expect.objectContaining({
        gameId: 'g1',
        targetId: 'p1',
        kind: 'player',
        name: 'Alice',
        from: 0,
        to: 12,
        reason: 'set',
        questionId: 'q1',
      }),
    ])
  })

  it('clamps a set score to a whole number of at least 0', async () => {
    const { result } = renderHook(() => useScoreboard(game))
    await waitFor(() => expect(scoreOf(result, 't1')).toBe(0))

    await act(() => result.current.set('t1', 'team', 7.6))
    expect((await db.teams.get('t1'))?.score).toBe(8)
    await act(() => result.current.set('t1', 'team', -3))
    expect((await db.teams.get('t1'))?.score).toBe(0)
  })

  it('logs ± steps, but not changes that leave the score as it was', async () => {
    const { result } = renderHook(() => useScoreboard(game))
    await waitFor(() => expect(scoreOf(result, 't1')).toBe(0))

    await act(() => result.current.adjust('t1', 'team', 5))
    await act(() => result.current.adjust('p1', 'player', -5))
    await act(() => result.current.set('t1', 'team', 5))

    const events = await db.scoreEvents.toArray()
    expect(events).toEqual([
      expect.objectContaining({ targetId: 't1', kind: 'team', from: 0, to: 5, reason: 'step' }),
    ])
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it("lists a game's score changes newest first", async () => {
    const change = { targetId: 'p1', kind: 'player' as const, name: 'Alice', questionId: null }
    await db.scoreEvents.bulkAdd([
      { ...change, id: 'e1', gameId: 'g1', from: 0, to: 1, reason: 'step', timestamp: 1 },
      { ...change, id: 'e2', gameId: 'g1', from: 1, to: 4, reason: 'set', timestamp: 2 },
      { ...change, id: 'e3', gameId: 'g2', from: 0, to: 9, reason: 'set', timestamp: 3 },
    ])

    const { result } = renderHook(() => useScoreHistory('g1'))

    await waitFor(() => expect(result.current.map(e => e.id)).toEqual(['e2', 'e1']))
  })
})
