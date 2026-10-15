// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Layout, Widget } from '@/db'
import { loadGameLayouts } from '@/db/layouts'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'

const layout = (id: string, gameId: string | null): Layout => ({
  id,
  gameId,
  name: id,
  target: 'player',
  phase: null,
  theme: { ...DEFAULT_LAYOUT_THEME },
  isActive: true,
  order: 0,
})

const widget = (id: string, layoutId: string): Widget => ({
  id,
  layoutId,
  type: 'question',
  config: {},
  grid: { x: 0, y: 0, w: 12, h: 1 },
  breakpoints: {},
  order: 0,
})

beforeEach(async () => {
  await Promise.all([db.layouts.clear(), db.widgets.clear()])
})

describe('loadGameLayouts', () => {
  it("returns the game's layouts and the templates, each with its own widgets", async () => {
    await db.layouts.bulkPut([
      layout('mine', 'g1'),
      layout('template', null),
      layout('other', 'g2'),
    ])
    await db.widgets.bulkPut([
      widget('w1', 'mine'),
      widget('w2', 'template'),
      widget('w3', 'other'),
      widget('w4', 'mine'),
    ])
    const loaded = await loadGameLayouts('g1')
    const byId = Object.fromEntries(loaded.map(b => [b.layout.id, b.widgets.map(w => w.id).sort()]))
    expect(byId).toEqual({ mine: ['w1', 'w4'], template: ['w2'] })
  })

  it('is empty when nothing is stored', async () => {
    expect(await loadGameLayouts('g1')).toEqual([])
  })
})
