// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { db } from '@/db'
import type { GameLogEntry } from '@/db'
import { buildFocusFlags, buildFocusLapses, formatAway } from '@/lib/focus-flags'
import { FocusFlagsPanel } from '@/components/gamemaster/FocusFlagsPanel'

let n = 0
const entry = (at: number, kind: GameLogEntry['kind'], over: Partial<GameLogEntry> = {}) =>
  ({
    id: `e${n++}`,
    gameId: 'g1',
    at,
    kind,
    actorId: null,
    subjectId: null,
    data: {},
    ...over,
  }) satisfies GameLogEntry

const hidden = (at: number, playerId: string) =>
  entry(at, 'player_hidden', { actorId: playerId, subjectId: playerId })
const back = (at: number, playerId: string) =>
  entry(at, 'player_back', { actorId: playerId, subjectId: playerId })
const shown = (at: number, round: string, question: number) =>
  entry(at, 'question_shown', { subjectId: 'q', data: { round, question } })

const players = [
  { id: 'p1', name: 'Ann', teamId: 't1' },
  { id: 'p2', name: 'Bob', teamId: 't1' },
  { id: 'p3', name: 'Cy', teamId: null },
]
const teams = [{ id: 't1', name: 'Quizzards', color: '#336699' }]

describe('buildFocusLapses', () => {
  it('counts lapses only while the game runs, with the question on show', () => {
    const lapses = buildFocusLapses([
      hidden(5, 'p1'), // lobby
      back(6, 'p1'),
      entry(10, 'game_started'),
      hidden(15, 'p1'),
      back(17, 'p1'),
      shown(20, 'Round 1', 2),
      hidden(25, 'p2'),
      back(40, 'p2'),
      entry(50, 'game_paused'),
      hidden(55, 'p3'), // paused
      back(56, 'p3'),
      entry(60, 'game_resumed'),
      hidden(70, 'p3'),
      entry(90, 'game_ended'),
      hidden(95, 'p1'), // ended
    ])
    expect(lapses).toEqual([
      { playerId: 'p1', at: 15, awayMs: 2, round: null, question: null },
      { playerId: 'p2', at: 25, awayMs: 15, round: 'Round 1', question: 2 },
      { playerId: 'p3', at: 70, awayMs: null, round: 'Round 1', question: 2 },
    ])
  })

  it('ends a lapse when the player disconnects, and reads entries in time order', () => {
    const lapses = buildFocusLapses([
      entry(30, 'player_disconnected', { subjectId: 'p1' }),
      hidden(20, 'p1'),
      entry(0, 'game_started'),
    ])
    expect(lapses).toEqual([{ playerId: 'p1', at: 20, awayMs: 10, round: null, question: null }])
  })

  it('ignores a repeated hide until the player is back', () => {
    const lapses = buildFocusLapses([
      entry(0, 'game_started'),
      hidden(10, 'p1'),
      hidden(12, 'p1'),
      back(20, 'p1'),
    ])
    expect(lapses).toHaveLength(1)
    expect(lapses[0].awayMs).toBe(10)
  })
})

describe('buildFocusFlags', () => {
  it('groups by team, keeps teamless players apart and puts the most lapses first', () => {
    const flags = buildFocusFlags(
      [
        { playerId: 'p3', at: 1, awayMs: 5000, round: null, question: null },
        { playerId: 'p1', at: 2, awayMs: 1000, round: null, question: null },
        { playerId: 'p2', at: 3, awayMs: null, round: null, question: null },
      ],
      players,
      teams
    )
    expect(flags.map(f => [f.id, f.name, f.color, f.lapses.length, f.awayMs])).toEqual([
      ['t1', 'Quizzards', '#336699', 2, 1000],
      ['p3', 'Cy', null, 1, 5000],
    ])
  })
})

describe('formatAway', () => {
  it('shows seconds, then minutes and seconds', () => {
    expect(formatAway(4_400)).toBe('4s')
    expect(formatAway(125_000)).toBe('2m 05s')
  })
})

describe('FocusFlagsPanel', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map(t => t.clear()))
  })

  it('says when no one has left the game', async () => {
    render(<FocusFlagsPanel game={{ id: 'g1' }} players={players} teams={teams} />)
    expect(await screen.findByText('No one has left the game during play.')).toBeInTheDocument()
  })

  it('lists each team with its lapses from the game log', async () => {
    await act(async () => {
      await db.gameLog.bulkAdd([
        entry(0, 'game_started'),
        shown(1_000, 'Round 1', 3),
        hidden(2_000, 'p1'),
        back(14_000, 'p1'),
        hidden(20_000, 'p2'),
        entry(30_000, 'game_started', { gameId: 'other' }),
      ])
    })
    render(<FocusFlagsPanel game={{ id: 'g1' }} players={players} teams={teams} />)
    expect(await screen.findByText('Quizzards')).toBeInTheDocument()
    expect(screen.getByText('2 times · 12s')).toBeInTheDocument()
    expect(screen.getByText('12s')).toBeInTheDocument()
    expect(screen.getByText('still away')).toBeInTheDocument()
    expect(screen.getAllByText('Round 1 · Q3')).toHaveLength(2)
    expect(screen.getByText('Ann')).toBeInTheDocument()
  })
})
