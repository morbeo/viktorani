// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Game, Layout } from '@/db'
import { layoutCommands, phaseCommands } from '@/components/gamemaster/layout-commands'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'

const layout = (id: string, gameId: string | null): Layout => ({
  id,
  gameId,
  name: id,
  target: 'screen',
  phase: null,
  theme: { ...DEFAULT_LAYOUT_THEME },
  isActive: true,
  order: 0,
})

beforeEach(async () => {
  await db.games.clear()
  await db.games.put({ id: 'g1', name: 'Quiz', createdAt: 0, updatedAt: 0 } as Game)
})

describe('phaseCommands', () => {
  it('holds each running phase, or goes back to automatic', () => {
    const onOverride = vi.fn()
    const commands = phaseCommands(onOverride)
    expect(commands.map(c => c.label)).toEqual([
      'Layouts: automatic',
      'Layouts: Question',
      'Layouts: Buzzed',
      'Layouts: Reveal',
      'Layouts: Scoreboard',
    ])
    commands.find(c => c.label === 'Layouts: Scoreboard')!.run()
    commands[0].run()
    expect(onOverride.mock.calls).toEqual([['scoreboard'], [null]])
  })
})

describe('layoutCommands', () => {
  it('shows a layout on a surface for the current phase, and clears it again', async () => {
    const onGameChange = vi.fn()
    const commands = layoutCommands({
      game: { id: 'g1' },
      phase: 'reveal',
      layouts: [{ layout: layout('big', 'g1'), widgets: [] }],
      onGameChange,
    })
    expect(commands.map(c => c.label)).toContain('Show layout on screen: big')
    expect(commands.map(c => c.label)).toContain('Show layout on phones: Built-in default')

    commands.find(c => c.label === 'Show layout on screen: big')!.run()
    await vi.waitFor(() =>
      expect(onGameChange).toHaveBeenCalledWith(
        expect.objectContaining({ layoutAssignments: { screen: { reveal: 'big' } } })
      )
    )
    expect((await db.games.get('g1'))?.layoutAssignments).toEqual({ screen: { reveal: 'big' } })

    const clear = layoutCommands({
      game: { id: 'g1', layoutAssignments: { screen: { reveal: 'big' } } },
      phase: 'reveal',
      layouts: [],
      onGameChange,
    }).find(c => c.label === 'Show layout on screen: automatic')!
    clear.run()
    await vi.waitFor(async () => expect((await db.games.get('g1'))?.layoutAssignments).toEqual({}))
  })
})
