import { describe, it, expect } from 'vitest'
import type { Layout, LayoutTarget, Widget } from '@/db'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import {
  BUILTIN_LAYOUTS,
  BUILTIN_LAYOUT_PREFIX,
  isRenderable,
  layoutsForPhases,
  resolveLayout,
  type LayoutBundle,
} from '@/widgets/layouts'

function bundle(
  id: string,
  layout: Partial<Layout> = {},
  widgets?: Partial<Widget>[]
): LayoutBundle {
  return {
    layout: {
      id,
      gameId: null,
      name: id,
      target: 'screen',
      phase: null,
      theme: { ...DEFAULT_LAYOUT_THEME },
      isActive: true,
      order: 0,
      ...layout,
    },
    widgets: (widgets ?? [{}]).map((w, i) => ({
      id: `${id}-w${i}`,
      layoutId: id,
      type: 'question',
      config: {},
      grid: { x: 0, y: i, w: 12, h: 1 },
      breakpoints: {},
      order: i,
      ...w,
    })),
  }
}

const pick = (
  stored: LayoutBundle[],
  gameId: string | null = 'g1',
  phase: Layout['phase'] = null
) => resolveLayout(stored, { target: 'screen', gameId, phase }).layout.id

describe('BUILTIN_LAYOUTS', () => {
  it.each(BUILTIN_LAYOUTS.map(b => [b.layout.id, b] as const))('%s is renderable', (_id, b) => {
    expect(isRenderable(b, b.layout.target)).toBe(true)
  })

  it.each<LayoutTarget>(['gamemaster', 'player', 'screen', 'scoreboard'])(
    'has an all-phase default for %s',
    target => {
      expect(BUILTIN_LAYOUTS.some(b => b.layout.target === target && b.layout.phase === null)).toBe(
        true
      )
    }
  )

  it('lays the screen default out as today’s stacked projector view', () => {
    const screen = resolveLayout([], { target: 'screen', gameId: null, phase: null })
    expect(screen.widgets.map(w => w.type)).toEqual([
      'announcement',
      'round_info',
      'question',
      'media',
      'answers',
      'timer',
      'scoreboard',
      'game_log',
    ])
    expect(screen.widgets.every(w => w.grid.x === 0 && w.grid.w === 12)).toBe(true)
  })

  it('drops the question and timers from the screen once the game has ended', () => {
    const ended = resolveLayout([], { target: 'screen', gameId: null, phase: 'ended' })
    expect(ended.widgets.map(w => w.type)).toEqual([
      'announcement',
      'round_info',
      'scoreboard',
      'game_log',
    ])
  })
  it.each([
    ['gamemaster', null, ['round_info', 'question', 'buzzer', 'timer']],
    ['gamemaster', 'ended', ['round_info', 'question']],
    ['player', null, ['announcement', 'question', 'buzzer', 'timer']],
    ['player', 'ended', ['announcement']],
  ] as const)('lays the %s default out for phase %s as its fixed view', (target, phase, types) => {
    const b = resolveLayout([], { target, gameId: null, phase })
    expect(b.layout.id).toBe(`${BUILTIN_LAYOUT_PREFIX}${target}:${phase ?? 'all'}`)
    expect(b.widgets.map(w => w.type)).toEqual(types)
  })
})

describe('resolveLayout', () => {
  it('falls back to the built-in default when nothing is stored', () => {
    expect(pick([])).toBe(`${BUILTIN_LAYOUT_PREFIX}screen:all`)
  })

  it('uses the built-in phase default over the all-phase one', () => {
    expect(pick([], null, 'ended')).toBe(`${BUILTIN_LAYOUT_PREFIX}screen:ended`)
  })

  it('prefers a stored layout over the built-in default', () => {
    expect(pick([bundle('template')])).toBe('template')
  })

  it("prefers this game's layout over a global template", () => {
    expect(pick([bundle('template'), bundle('mine', { gameId: 'g1' })])).toBe('mine')
  })

  it("ignores another game's layouts", () => {
    expect(pick([bundle('theirs', { gameId: 'g2' })])).toBe(`${BUILTIN_LAYOUT_PREFIX}screen:all`)
  })

  it('ignores layouts for another target', () => {
    expect(pick([bundle('player', { target: 'player' }, [{ type: 'buzzer' }])])).toBe(
      `${BUILTIN_LAYOUT_PREFIX}screen:all`
    )
  })

  it('prefers an exact phase over an all-phase layout, and skips other phases', () => {
    const stored = [
      bundle('all'),
      bundle('reveal', { phase: 'reveal' }),
      bundle('ended', { phase: 'ended' }),
    ]
    expect(pick(stored, 'g1', 'reveal')).toBe('reveal')
    expect(pick(stored, 'g1', 'question')).toBe('all')
  })

  it("prefers the game's own all-phase layout over a template for the exact phase", () => {
    const stored = [
      bundle('template-reveal', { phase: 'reveal' }),
      bundle('mine', { gameId: 'g1' }),
    ]
    expect(pick(stored, 'g1', 'reveal')).toBe('mine')
  })

  it('prefers the active layout, then the lowest order', () => {
    expect(
      pick([bundle('inactive', { isActive: false, order: 0 }), bundle('active', { order: 5 })])
    ).toBe('active')
    expect(pick([bundle('second', { order: 2 }), bundle('first', { order: 1 })])).toBe('first')
  })

  it.each([
    ['a widget type not allowed on the target', [{ type: 'buzzer' as const }]],
    ['a widget config its type rejects', [{ config: { unexpected: true } }]],
    ['a widget outside the grid', [{ grid: { x: 8, y: 0, w: 8, h: 1 } }]],
    ['a widget that belongs to another layout', [{ layoutId: 'other' }]],
  ])('skips a layout with %s and uses the next best', (_why, widgets) => {
    expect(pick([bundle('broken', {}, widgets), bundle('fine', { order: 1 })])).toBe('fine')
  })

  it('falls back to the built-in default when the only layout is invalid', () => {
    const broken = bundle('broken', { theme: { ...DEFAULT_LAYOUT_THEME, accent: 'red' } })
    expect(pick([broken])).toBe(`${BUILTIN_LAYOUT_PREFIX}screen:all`)
  })
})

describe('layoutsForPhases', () => {
  const ids = (stored: LayoutBundle[], gameId = 'g1') =>
    layoutsForPhases(stored, 'screen', gameId).map(b => b.layout.id)

  it('is empty when only the built-in default fits', () => {
    expect(ids([])).toEqual([])
    expect(
      ids([bundle('player', { target: 'player' }), bundle('other', { gameId: 'g2' })])
    ).toEqual([])
  })

  it("keeps each phase's pick once, and nothing a phase would not pick", () => {
    const stored = [
      bundle('all'),
      bundle('all-loser', { order: 1 }),
      bundle('ended', { phase: 'ended' }),
      bundle('reveal', { phase: 'reveal', gameId: 'g1' }),
      bundle('reveal-template', { phase: 'reveal' }),
    ]
    expect(ids(stored).sort()).toEqual(['all', 'ended', 'reveal'])
  })

  it('leaves out layouts that cannot render', () => {
    expect(ids([bundle('broken', {}, [{ type: 'buzzer' }])])).toEqual([])
  })

  it('resolves every phase among its picks as among everything stored', () => {
    const stored = [
      bundle('all'),
      bundle('mine', { gameId: 'g1', order: 3 }),
      bundle('ended', { phase: 'ended' }),
      bundle('lobby-inactive', { phase: 'lobby', isActive: false }),
      bundle('lobby', { phase: 'lobby', order: 2 }),
    ]
    const picks = layoutsForPhases(stored, 'screen', 'g1')
    for (const phase of [null, 'lobby', 'question', 'ended'] as const) {
      expect(pick(picks, 'g1', phase)).toBe(pick(stored, 'g1', phase))
    }
  })
})
