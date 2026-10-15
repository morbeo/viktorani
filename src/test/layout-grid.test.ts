import { describe, it, expect } from 'vitest'
import {
  GRID_COLUMNS,
  isValidRect,
  migrateWidgetsToGrid,
  packRows,
  resolveRect,
  type LegacyWidget,
} from '@/lib/layout-grid'

describe('isValidRect', () => {
  it.each([
    { x: 0, y: 0, w: 12, h: 1 },
    { x: 6, y: 3, w: 6, h: 2 },
    { x: 11, y: 0, w: 1, h: 1 },
  ])('accepts %o', rect => {
    expect(isValidRect(rect)).toBe(true)
  })

  it.each([
    ['overflows the columns', { x: 6, y: 0, w: 7, h: 1 }],
    ['starts left of the grid', { x: -1, y: 0, w: 2, h: 1 }],
    ['starts above the grid', { x: 0, y: -1, w: 2, h: 1 }],
    ['has no width', { x: 0, y: 0, w: 0, h: 1 }],
    ['has no height', { x: 0, y: 0, w: 2, h: 0 }],
    ['has fractional cells', { x: 0.5, y: 0, w: 2, h: 1 }],
  ])('rejects a rect that %s', (_why, rect) => {
    expect(isValidRect(rect)).toBe(false)
  })
})

describe('resolveRect', () => {
  const grid = { x: 0, y: 0, w: 6, h: 1 }
  const phone = { x: 0, y: 2, w: 12, h: 1 }

  it('uses the breakpoint override when there is one', () => {
    expect(resolveRect({ grid, breakpoints: { phone } }, 'phone')).toBe(phone)
  })

  it('falls back to the base grid when the breakpoint has no override', () => {
    expect(resolveRect({ grid, breakpoints: { phone } }, 'tv')).toBe(grid)
  })

  it('uses the base grid when no breakpoint applies', () => {
    expect(resolveRect({ grid, breakpoints: { phone } }, null)).toBe(grid)
  })
})

describe('packRows', () => {
  it('puts items side by side until the row is full, then wraps', () => {
    expect(
      packRows([
        { w: 6, h: 1 },
        { w: 6, h: 1 },
        { w: 4, h: 1 },
      ])
    ).toEqual([
      { x: 0, y: 0, w: 6, h: 1 },
      { x: 6, y: 0, w: 6, h: 1 },
      { x: 0, y: 1, w: 4, h: 1 },
    ])
  })

  it('starts the next row below the tallest item in the current one', () => {
    expect(
      packRows([
        { w: 6, h: 3 },
        { w: 6, h: 1 },
        { w: 12, h: 1 },
      ])
    ).toEqual([
      { x: 0, y: 0, w: 6, h: 3 },
      { x: 6, y: 0, w: 6, h: 1 },
      { x: 0, y: 3, w: 12, h: 1 },
    ])
  })

  it('clamps widths into the grid', () => {
    expect(packRows([{ w: 20, h: 1 }])).toEqual([{ x: 0, y: 0, w: GRID_COLUMNS, h: 1 }])
  })
})

describe('migrateWidgetsToGrid', () => {
  const base = { type: 'text' as const, config: {} }
  const legacy = (
    id: string,
    layoutId: string,
    order: number,
    width: 'full' | 'half'
  ): LegacyWidget => ({ ...base, id, layoutId, order, width })

  it('packs half widgets in pairs and gives full widgets their own row, in order', () => {
    const migrated = migrateWidgetsToGrid([
      legacy('c', 'l1', 2, 'full'),
      legacy('a', 'l1', 0, 'half'),
      legacy('b', 'l1', 1, 'half'),
      legacy('d', 'l1', 3, 'half'),
    ])
    expect(Object.fromEntries(migrated.map(w => [w.id, w.grid]))).toEqual({
      a: { x: 0, y: 0, w: 6, h: 1 },
      b: { x: 6, y: 0, w: 6, h: 1 },
      c: { x: 0, y: 1, w: 12, h: 1 },
      d: { x: 0, y: 2, w: 6, h: 1 },
    })
  })

  it('packs each layout separately', () => {
    const migrated = migrateWidgetsToGrid([
      legacy('a', 'l1', 0, 'half'),
      legacy('b', 'l2', 1, 'half'),
    ])
    expect(migrated.map(w => w.grid)).toEqual([
      { x: 0, y: 0, w: 6, h: 1 },
      { x: 0, y: 0, w: 6, h: 1 },
    ])
  })

  it('drops width, adds empty breakpoints and keeps everything else', () => {
    const [w] = migrateWidgetsToGrid([{ ...legacy('a', 'l1', 0, 'half'), config: { text: 'hi' } }])
    expect(w).not.toHaveProperty('width')
    expect(w).toEqual({
      id: 'a',
      layoutId: 'l1',
      type: 'text',
      config: { text: 'hi' },
      order: 0,
      grid: { x: 0, y: 0, w: 6, h: 1 },
      breakpoints: {},
    })
  })

  it('treats a widget with no width as full', () => {
    const [w] = migrateWidgetsToGrid([{ ...base, id: 'a', layoutId: 'l1', order: 0 }])
    expect(w.grid).toEqual({ x: 0, y: 0, w: 12, h: 1 })
  })

  it('leaves widgets that already have a grid rect as they are', () => {
    const grid = { x: 3, y: 4, w: 2, h: 2 }
    const phone = { x: 0, y: 0, w: 12, h: 1 }
    const [w] = migrateWidgetsToGrid([
      { ...base, id: 'a', layoutId: 'l1', order: 0, grid, breakpoints: { phone } },
    ])
    expect(w).toMatchObject({ grid, breakpoints: { phone } })
  })
})
