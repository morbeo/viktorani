// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Game, Layout } from '@/db'
import { assign, setLayoutAssignment, withoutSlot } from '@/db/games'
import { GameSchema } from '@/db/snapshot-schema'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import { choiceLabel, layoutChoices } from '@/lib/layout-assignments'
import type { LayoutBundle } from '@/widgets/layouts'

const bundle = (id: string, patch: Partial<Layout>): LayoutBundle => ({
  layout: {
    id,
    gameId: null,
    name: id,
    target: 'player',
    phase: null,
    theme: { ...DEFAULT_LAYOUT_THEME },
    isActive: true,
    order: 0,
    ...patch,
  },
  widgets: [],
})

describe('assign', () => {
  it('sets and clears a choice, dropping surfaces with none left', () => {
    const one = assign(undefined, 'screen', 'reveal', 'l1')
    expect(one).toEqual({ screen: { reveal: 'l1' } })
    const two = assign(one, 'player', 'all', 'l2')
    expect(two).toEqual({ screen: { reveal: 'l1' }, player: { all: 'l2' } })
    expect(assign(two, 'screen', 'reveal', null)).toEqual({ player: { all: 'l2' } })
    // The input is left as it was
    expect(one).toEqual({ screen: { reveal: 'l1' } })
  })

  it('drops one slot', () => {
    expect(withoutSlot({ all: 'a', ended: 'b' }, 'all')).toEqual({ ended: 'b' })
    expect(withoutSlot(undefined, 'all')).toEqual({})
  })
})

describe('setLayoutAssignment', () => {
  beforeEach(async () => {
    await db.games.clear()
  })

  it('saves the choice on the game and returns the patch', async () => {
    await db.games.put({ id: 'g1', name: 'Quiz', createdAt: 0, updatedAt: 0 } as Game)
    const patch = await setLayoutAssignment({ id: 'g1' }, 'screen', 'all', 'l1')
    expect(patch.layoutAssignments).toEqual({ screen: { all: 'l1' } })
    expect((await db.games.get('g1'))?.layoutAssignments).toEqual({ screen: { all: 'l1' } })
  })
})

describe('layoutChoices', () => {
  it("lists the game's own layouts, then templates, then built-ins, for the target", () => {
    const stored = [
      bundle('tpl-b', { order: 2 }),
      bundle('tpl-a', { order: 1 }),
      bundle('mine', { gameId: 'g1' }),
      bundle('theirs', { gameId: 'g2' }),
      bundle('screen', { target: 'screen' }),
    ]
    const choices = layoutChoices(stored, 'player', 'g1')
    expect(choices.map(c => [c.bundle.layout.id, c.origin])).toEqual([
      ['mine', 'game'],
      ['tpl-a', 'template'],
      ['tpl-b', 'template'],
      ['builtin:player:all', 'builtin'],
      ['builtin:player:ended', 'builtin'],
    ])
    expect(choices.map(choiceLabel)).toEqual([
      'mine',
      'tpl-a (template)',
      'tpl-b (template)',
      'Built-in default',
      'Built-in default (Game over)',
    ])
  })
})

describe('layout choices in backups', () => {
  const game = {
    id: 'g1',
    name: 'Quiz',
    status: 'active',
    roomId: null,
    roundIds: [],
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: false,
    createdAt: 0,
    updatedAt: 0,
  }

  it('keeps them, and reads backups without them', () => {
    const layoutAssignments = { screen: { all: 'l1', reveal: 'builtin:screen:all' } }
    expect(GameSchema.parse({ ...game, layoutAssignments }).layoutAssignments).toEqual(
      layoutAssignments
    )
    expect(GameSchema.parse(game).layoutAssignments).toBeUndefined()
  })

  it('rejects an unknown surface or phase', () => {
    expect(GameSchema.safeParse({ ...game, layoutAssignments: { tv: {} } }).success).toBe(false)
    expect(
      GameSchema.safeParse({ ...game, layoutAssignments: { screen: { intermission: 'l1' } } })
        .success
    ).toBe(false)
  })
})
