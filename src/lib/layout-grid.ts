import type { GridRect, LayoutBreakpoint, LayoutTheme, Widget } from '@/db'

/**
 * Pure helpers for the layout model v2 grid (#409): placement math, breakpoint resolution
 * and the migration from the old `width: 'full' | 'half'` widgets.
 */

/** Number of columns in every layout grid, whatever the device. */
export const GRID_COLUMNS = 12

/** A widget's size on the grid, without a position. */
export type GridSize = Pick<GridRect, 'w' | 'h'>

/** The theme a new or migrated layout starts with: everything inherits the app theme. */
export const DEFAULT_LAYOUT_THEME: Readonly<LayoutTheme> = Object.freeze({
  background: null,
  accent: null,
  fontScale: 1,
  logo: null,
})

/** Whether `rect` has whole-cell values and fits inside the grid's columns. */
export function isValidRect(rect: GridRect): boolean {
  const { x, y, w, h } = rect
  return (
    [x, y, w, h].every(Number.isInteger) &&
    x >= 0 &&
    y >= 0 &&
    w >= 1 &&
    h >= 1 &&
    x + w <= GRID_COLUMNS
  )
}

/** The rect a widget uses on `breakpoint`: its override if it has one, else its base `grid`. */
export function resolveRect(
  widget: Pick<Widget, 'grid' | 'breakpoints'>,
  breakpoint: LayoutBreakpoint | null
): GridRect {
  return (breakpoint && widget.breakpoints[breakpoint]) || widget.grid
}

/**
 * Place sizes left to right in a row, wrapping to a new row when the next one doesn't fit.
 * A row is as tall as its tallest item, so wrapped rows never overlap.
 */
export function packRows(sizes: readonly GridSize[]): GridRect[] {
  const rects: GridRect[] = []
  let x = 0
  let y = 0
  let rowHeight = 0
  for (const { w, h } of sizes) {
    const width = Math.min(Math.max(w, 1), GRID_COLUMNS)
    if (x + width > GRID_COLUMNS) {
      y += rowHeight
      x = 0
      rowHeight = 0
    }
    rects.push({ x, y, w: width, h })
    x += width
    rowHeight = Math.max(rowHeight, h)
  }
  return rects
}

/** A widget as stored before Dexie v16, with `width` instead of a grid rect. */
export type LegacyWidget = Omit<Widget, 'grid' | 'breakpoints'> & {
  width?: 'full' | 'half'
  grid?: GridRect
  breakpoints?: Widget['breakpoints']
}

/** Grid columns the old widths took: a full widget spans the grid, a half one half of it. */
const LEGACY_WIDTH_COLUMNS = { full: GRID_COLUMNS, half: GRID_COLUMNS / 2 } as const

/**
 * Convert pre-v16 widgets to grid placement (Dexie v16 migration).
 *
 * @remarks
 * Each layout's widgets are packed into one-row-tall rows in `order`, so two consecutive half
 * widgets share a row and a full one takes a row of its own, matching how the old flow layout
 * showed them. Widgets that already have a `grid` keep it. `width` is dropped.
 */
export function migrateWidgetsToGrid(widgets: readonly LegacyWidget[]): Widget[] {
  const byLayout = new Map<string, LegacyWidget[]>()
  for (const w of [...widgets].sort((a, b) => a.order - b.order)) {
    const group = byLayout.get(w.layoutId)
    if (group) group.push(w)
    else byLayout.set(w.layoutId, [w])
  }
  const migrated: Widget[] = []
  for (const group of byLayout.values()) {
    const legacy = group.filter(w => !w.grid)
    const rects = packRows(legacy.map(w => ({ w: LEGACY_WIDTH_COLUMNS[w.width ?? 'full'], h: 1 })))
    let next = 0
    for (const w of group) {
      const widget = { ...w, grid: w.grid ?? rects[next++], breakpoints: w.breakpoints ?? {} }
      delete widget.width
      migrated.push(widget)
    }
  }
  return migrated
}
