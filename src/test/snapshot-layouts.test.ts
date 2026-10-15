// @vitest-pool vmForks
// Layouts and widgets in backups (#409): exported, validated, and restored all-or-nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Layout, Widget } from '@/db'
import { exportDatabase, importDatabase } from '@/db/snapshot'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'

const LAYOUT: Layout = {
  id: 'l1',
  gameId: null,
  name: 'Big screen',
  target: 'screen',
  phase: 'question',
  theme: { background: '#102030', accent: '#C8933A', fontScale: 1.25, logo: null },
  isActive: true,
  order: 0,
}

const WIDGET: Widget = {
  id: 'w1',
  layoutId: 'l1',
  type: 'question',
  config: {},
  grid: { x: 0, y: 0, w: 8, h: 2 },
  breakpoints: { phone: { x: 0, y: 0, w: 12, h: 2 } },
  order: 0,
}

function jsonFile(value: unknown) {
  return new File([JSON.stringify(value)], 'backup.json', { type: 'application/json' })
}

function snapshot(layouts: unknown[] = [LAYOUT], widgets: unknown[] = [WIDGET]) {
  return { version: 2, exportedAt: 1, layouts, widgets }
}

beforeEach(async () => {
  await Promise.all([db.layouts.clear(), db.widgets.clear()])
})

describe('exportDatabase — layouts', () => {
  it('includes layouts and widgets', async () => {
    await db.layouts.put(LAYOUT)
    await db.widgets.put(WIDGET)
    let captured: Blob | null = null
    ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementationOnce((blob: Blob) => {
      captured = blob
      return 'blob:captured'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await exportDatabase()

    const exported = JSON.parse(await (captured as unknown as Blob).text())
    expect(exported.layouts).toEqual([LAYOUT])
    expect(exported.widgets).toEqual([WIDGET])
  })
})

describe('importDatabase — layouts', () => {
  it('restores layouts and widgets', async () => {
    await importDatabase(jsonFile(snapshot()))

    expect(await db.layouts.get('l1')).toEqual(LAYOUT)
    expect(await db.widgets.get('w1')).toEqual(WIDGET)
  })

  it('round-trips an export through import', async () => {
    await db.layouts.put(LAYOUT)
    await db.widgets.put(WIDGET)
    let captured: Blob | null = null
    ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementationOnce((blob: Blob) => {
      captured = blob
      return 'blob:captured'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await exportDatabase()
    await Promise.all([db.layouts.clear(), db.widgets.clear()])

    await importDatabase(
      new File([await (captured as unknown as Blob).text()], 'backup.json', {
        type: 'application/json',
      })
    )

    expect(await db.layouts.toArray()).toEqual([LAYOUT])
    expect(await db.widgets.toArray()).toEqual([WIDGET])
  })

  it('imports an older backup with no layouts', async () => {
    await expect(importDatabase(jsonFile({ version: 2, exportedAt: 1 }))).resolves.toBeUndefined()
    expect(await db.layouts.count()).toBe(0)
  })

  it('defaults a missing phase, theme and breakpoints', async () => {
    const { phase: _phase, theme: _theme, ...layout } = LAYOUT
    const { breakpoints: _breakpoints, ...widget } = WIDGET
    void [_phase, _theme, _breakpoints]

    await importDatabase(jsonFile(snapshot([layout], [widget])))

    expect(await db.layouts.get('l1')).toMatchObject({ phase: null, theme: DEFAULT_LAYOUT_THEME })
    expect(await db.widgets.get('w1')).toMatchObject({ breakpoints: {} })
  })

  it.each([
    ['an unknown target', { target: 'admin' }, /layouts\.0\.target/],
    ['an unknown phase', { phase: 'intermission' }, /layouts\.0\.phase/],
    ['a colour that is not #rrggbb', { theme: { ...LAYOUT.theme, accent: 'red' } }, /accent/],
    ['an out-of-range font scale', { theme: { ...LAYOUT.theme, fontScale: 5 } }, /fontScale/],
    [
      'a javascript: logo',
      { theme: { ...LAYOUT.theme, logo: 'javascript:alert(1)' } },
      /logo must be a data:image\/ or https:\/\/ URL/,
    ],
    [
      'a non-image data: logo',
      { theme: { ...LAYOUT.theme, logo: 'data:text/html,<p>' } },
      /logo must be/,
    ],
  ])('rejects a layout with %s and writes nothing', async (_why, change, error) => {
    await expect(importDatabase(jsonFile(snapshot([{ ...LAYOUT, ...change }])))).rejects.toThrow(
      error
    )
    expect(await db.layouts.count()).toBe(0)
    expect(await db.widgets.count()).toBe(0)
  })

  it.each([
    [
      'overflows the grid columns',
      { grid: { x: 6, y: 0, w: 7, h: 1 } },
      /overflows the grid columns/,
    ],
    ['overflows the grid rows', { grid: { x: 0, y: 99, w: 12, h: 2 } }, /overflows the grid rows/],
    ['has a fractional rect', { grid: { x: 0.5, y: 0, w: 6, h: 1 } }, /widgets\.0\.grid\.x/],
    [
      'has an invalid phone override',
      { breakpoints: { phone: { x: 0, y: 0, w: 13, h: 1 } } },
      /widgets\.0\.breakpoints\.phone/,
    ],
    ['has an unknown type', { type: 'iframe' }, /widgets\.0\.type/],
    ['has no layout in the file', { layoutId: 'missing' }, /no layout with id missing/],
  ])('rejects a widget that %s and writes nothing', async (_why, change, error) => {
    await expect(
      importDatabase(jsonFile(snapshot([LAYOUT], [{ ...WIDGET, ...change }])))
    ).rejects.toThrow(error)
    expect(await db.layouts.count()).toBe(0)
    expect(await db.widgets.count()).toBe(0)
  })

  it('accepts an https or data:image logo', async () => {
    const layouts = [
      { ...LAYOUT, id: 'a', theme: { ...LAYOUT.theme, logo: 'https://example.com/logo.png' } },
      { ...LAYOUT, id: 'b', theme: { ...LAYOUT.theme, logo: 'data:image/png;base64,AAAA' } },
    ]
    await importDatabase(jsonFile(snapshot(layouts, [])))
    expect(await db.layouts.count()).toBe(2)
  })
})
