// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/transport', () => ({
  transportManager: { send: vi.fn() },
}))

import { db } from '@/db'
import { transportManager } from '@/transport'
import { useScoreboard } from '@/hooks/useScoreboard'
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
  await Promise.all([db.players.clear(), db.teams.clear(), db.difficulties.clear()])
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
})
