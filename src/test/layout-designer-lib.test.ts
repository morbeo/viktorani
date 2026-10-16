import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  DESIGNER_MAX_ROWS,
  clampRect,
  configFields,
  moveRect,
  nextFreeRect,
  pixelsToCells,
  pointToCell,
  rectsOn,
  resizeRect,
  swapOrder,
} from '@/lib/layout-designer'

describe('clampRect', () => {
  it('keeps a rect on the grid with whole cells', () => {
    expect(clampRect({ x: -2, y: -1, w: 4, h: 1 })).toEqual({ x: 0, y: 0, w: 4, h: 1 })
    expect(clampRect({ x: 10, y: 0, w: 6, h: 1 })).toEqual({ x: 6, y: 0, w: 6, h: 1 })
    expect(clampRect({ x: 1.4, y: 2.6, w: 0, h: 200 })).toEqual({
      x: 1,
      y: 0,
      w: 1,
      h: DESIGNER_MAX_ROWS,
    })
    expect(clampRect({ x: 0, y: 0, w: 20, h: 1 }).w).toBe(12)
  })

  it('treats a value that is not a number as 0', () => {
    expect(clampRect({ x: NaN, y: Infinity, w: NaN, h: 2 })).toEqual({ x: 0, y: 0, w: 1, h: 2 })
  })
})

describe('moveRect and resizeRect', () => {
  const rect = { x: 2, y: 1, w: 4, h: 2 }

  it('moves by whole cells without changing size or leaving the grid', () => {
    expect(moveRect(rect, 3, 2)).toEqual({ x: 5, y: 3, w: 4, h: 2 })
    expect(moveRect(rect, 20, -5)).toEqual({ x: 8, y: 0, w: 4, h: 2 })
  })

  it('resizes from the bottom-right corner, at least one cell and within the grid', () => {
    expect(resizeRect(rect, 2, 1)).toEqual({ x: 2, y: 1, w: 6, h: 3 })
    expect(resizeRect(rect, -10, -10)).toEqual({ x: 2, y: 1, w: 1, h: 1 })
    expect(resizeRect(rect, 20, 0)).toEqual({ x: 2, y: 1, w: 10, h: 2 })
  })
})

describe('pixelsToCells and pointToCell', () => {
  it('rounds a drag to the nearest cell', () => {
    expect(pixelsToCells(149, 20, 100, 48)).toEqual({ dx: 1, dy: 0 })
    expect(pixelsToCells(151, 30, 100, 48)).toEqual({ dx: 2, dy: 1 })
    expect(pixelsToCells(-20, -10, 100, 48)).toEqual({ dx: 0, dy: 0 })
  })

  it('finds the cell under a point', () => {
    expect(pointToCell(250, 100, 100, 48)).toEqual({ x: 2, y: 2 })
  })

  it('treats an unmeasured canvas as no movement', () => {
    expect(pixelsToCells(300, 300, 0, 0)).toEqual({ dx: 0, dy: 0 })
    expect(pointToCell(300, 300, 0, 0)).toEqual({ x: 0, y: 0 })
  })
})

describe('nextFreeRect', () => {
  it('starts at the top left of an empty layout', () => {
    expect(nextFreeRect([], { w: 6, h: 1 })).toEqual({ x: 0, y: 0, w: 6, h: 1 })
  })

  it('goes below the lowest widget', () => {
    const rects = [
      { x: 0, y: 0, w: 6, h: 3 },
      { x: 6, y: 1, w: 6, h: 1 },
    ]
    expect(nextFreeRect(rects, { w: 12, h: 1 })).toEqual({ x: 0, y: 3, w: 12, h: 1 })
  })
})

describe('rectsOn', () => {
  it('uses each widget’s override for the device, else its base rect', () => {
    const base = { x: 0, y: 0, w: 6, h: 1 }
    const phone = { x: 0, y: 2, w: 12, h: 1 }
    const widgets = [
      { grid: base, breakpoints: { phone } },
      { grid: base, breakpoints: {} },
    ]
    expect(rectsOn(widgets, 'phone')).toEqual([phone, base])
    expect(rectsOn(widgets, null)).toEqual([base, base])
  })
})

describe('swapOrder', () => {
  const widgets = [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'c', order: 2 },
  ]

  it('swaps a widget with its neighbour', () => {
    expect(swapOrder(widgets, 'b', -1)).toEqual([
      { id: 'a', order: 1 },
      { id: 'b', order: 0 },
    ])
    expect(swapOrder(widgets, 'b', 1)).toEqual([
      { id: 'b', order: 2 },
      { id: 'c', order: 1 },
    ])
  })

  it('does nothing at either end or for an unknown widget', () => {
    expect(swapOrder(widgets, 'a', -1)).toEqual([])
    expect(swapOrder(widgets, 'c', 1)).toEqual([])
    expect(swapOrder(widgets, 'x', 1)).toEqual([])
  })

  it('still swaps widgets that share an order', () => {
    const tied = [
      { id: 'a', order: 0 },
      { id: 'b', order: 0 },
    ]
    const changes = swapOrder(tied, 'b', -1)
    const order = Object.fromEntries(tied.map(w => [w.id, w.order]))
    for (const { id, order: o } of changes) order[id] = o
    expect(order.b).toBeLessThan(order.a)
  })
})

describe('configFields', () => {
  it('reads text, number, true/false and choice fields in order', () => {
    const schema = z.strictObject({
      title: z.string(),
      size: z.number().min(1).max(5),
      count: z.number().optional(),
      shown: z.boolean().default(true),
      align: z.enum(['left', 'center']).nullable(),
      tags: z.array(z.string()),
    })
    expect(configFields(schema)).toEqual([
      { key: 'title', label: 'title', kind: 'text', multiline: false },
      { key: 'size', label: 'size', kind: 'number', min: 1, max: 5 },
      { key: 'count', label: 'count', kind: 'number' },
      { key: 'shown', label: 'shown', kind: 'boolean' },
      { key: 'align', label: 'align', kind: 'choice', options: ['left', 'center'] },
    ])
  })

  it('labels a field with its description and marks multi-line text', () => {
    const schema = z.strictObject({
      body: z.string().max(500).meta({ description: 'Text', multiline: true }).default(''),
      alt: z.string().describe('Description').optional(),
    })
    expect(configFields(schema)).toEqual([
      { key: 'body', label: 'Text', kind: 'text', multiline: true },
      { key: 'alt', label: 'Description', kind: 'text', multiline: false },
    ])
  })

  it('has no fields for an empty or non-object schema', () => {
    expect(configFields(z.strictObject({}))).toEqual([])
    expect(configFields(z.string())).toEqual([])
  })
})
