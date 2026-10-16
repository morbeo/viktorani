// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Layout, Widget } from '@/db'
import { copyLayout, duplicateWidget, loadLayoutBundle, restoreLayout } from '@/db/layout-editor'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import { BUILTIN_LAYOUTS } from '@/widgets/layouts'

const LAYOUT: Layout = {
  id: 'l1',
  gameId: null,
  name: 'Big screen',
  target: 'screen',
  phase: 'reveal',
  theme: { ...DEFAULT_LAYOUT_THEME, accent: '#112233' },
  isActive: true,
  order: 0,
}

const widget = (id: string, patch: Partial<Widget> = {}): Widget => ({
  id,
  layoutId: 'l1',
  type: 'question',
  config: {},
  grid: { x: 0, y: 0, w: 12, h: 1 },
  breakpoints: {},
  order: 0,
  ...patch,
})

beforeEach(async () => {
  await Promise.all([db.layouts.clear(), db.widgets.clear()])
})

describe('copyLayout', () => {
  it('copies a layout and its widgets with new ids, last in the target scope', async () => {
    await db.layouts.bulkPut([LAYOUT, { ...LAYOUT, id: 'l2', gameId: 'g1', order: 4 }])
    await db.widgets.bulkPut([
      widget('w1', { breakpoints: { tv: { x: 1, y: 1, w: 4, h: 2 } } }),
      widget('w2', { type: 'timer', order: 1 }),
    ])
    const source = (await loadLayoutBundle('l1'))!

    const copy = await copyLayout(source, { gameId: 'g1', name: 'Mine' })
    expect(copy).toMatchObject({ gameId: 'g1', name: 'Mine', phase: 'reveal', order: 5 })
    expect(copy.id).not.toBe('l1')
    expect(copy.theme).toEqual(LAYOUT.theme)

    const copied = await db.widgets.where('layoutId').equals(copy.id).sortBy('order')
    expect(copied.map(w => w.type)).toEqual(['question', 'timer'])
    expect(copied.every(w => w.id !== 'w1' && w.id !== 'w2')).toBe(true)
    expect(copied[0].breakpoints).toEqual({ tv: { x: 1, y: 1, w: 4, h: 2 } })
    // The source is untouched
    expect(await db.widgets.where('layoutId').equals('l1').count()).toBe(2)
  })

  it('copies a built-in layout into the templates, for another phase', async () => {
    const builtin = BUILTIN_LAYOUTS.find(b => b.layout.id === 'builtin:player:all')!
    const copy = await copyLayout(builtin, { gameId: null, name: 'Phones', phase: 'lobby' })
    expect(copy).toMatchObject({ gameId: null, phase: 'lobby', target: 'player', order: 0 })
    expect(await db.widgets.where('layoutId').equals(copy.id).count()).toBe(builtin.widgets.length)
  })
})

describe('restoreLayout', () => {
  it('puts the layout and exactly its saved widgets back', async () => {
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1'))
    const saved = (await loadLayoutBundle('l1'))!

    await db.layouts.update('l1', { name: 'Changed' })
    await db.widgets.update('w1', { grid: { x: 3, y: 3, w: 2, h: 2 } })
    await db.widgets.put(widget('w2'))

    await restoreLayout(saved)
    expect((await db.layouts.get('l1'))?.name).toBe('Big screen')
    expect(await db.widgets.where('layoutId').equals('l1').toArray()).toEqual([widget('w1')])
  })

  it('brings back a removed widget', async () => {
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1'))
    const saved = (await loadLayoutBundle('l1'))!
    await db.widgets.delete('w1')
    await restoreLayout(saved)
    expect(await db.widgets.get('w1')).toEqual(widget('w1'))
  })
})

describe('duplicateWidget', () => {
  it('copies a widget just below, last in reading order', async () => {
    await db.widgets.bulkPut([
      widget('w1', { grid: { x: 2, y: 1, w: 4, h: 3 }, config: { a: 1 } }),
      widget('w2', { order: 3 }),
    ])
    const copy = await duplicateWidget('w1')
    expect(copy).toMatchObject({ grid: { x: 2, y: 4, w: 4, h: 3 }, order: 4, config: { a: 1 } })
    expect(await db.widgets.get(copy!.id)).toEqual(copy)
  })

  it('stays on the grid at the bottom edge', async () => {
    await db.widgets.put(widget('w1', { grid: { x: 0, y: 98, w: 12, h: 2 } }))
    expect((await duplicateWidget('w1'))?.grid).toEqual({ x: 0, y: 98, w: 12, h: 2 })
  })

  it('does nothing for a widget that is gone', async () => {
    expect(await duplicateWidget('missing')).toBeNull()
    expect(await loadLayoutBundle('missing')).toBeNull()
  })
})
