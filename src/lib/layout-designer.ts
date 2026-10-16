import { z } from 'zod'
import type { GridRect, LayoutBreakpoint, Widget } from '@/db'
import { GRID_COLUMNS, resolveRect, type GridSize } from './layout-grid'

/**
 * Pure helpers for the layout designer (#412): where a new widget goes, how a drag or a
 * resize moves a rect, reading order, and the fields of a widget's config form.
 */

/** Bottom edge of the grid, as in the stored-data schema (`MAX_GRID_ROWS`). */
export const DESIGNER_MAX_ROWS = 100

/** Keep `rect` on the grid: whole cells, at least one cell big, inside columns and rows. */
export function clampRect(rect: GridRect): GridRect {
  // A value that isn't a number (say a pointer event without coordinates) counts as 0
  const cell = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0)
  const w = Math.min(Math.max(cell(rect.w), 1), GRID_COLUMNS)
  const h = Math.min(Math.max(cell(rect.h), 1), DESIGNER_MAX_ROWS)
  const x = Math.min(Math.max(cell(rect.x), 0), GRID_COLUMNS - w)
  const y = Math.min(Math.max(cell(rect.y), 0), DESIGNER_MAX_ROWS - h)
  return { x, y, w, h }
}

/** `rect` moved by whole cells, kept on the grid with its size unchanged. */
export function moveRect(rect: GridRect, dx: number, dy: number): GridRect {
  return clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy })
}

/** `rect` grown or shrunk from its bottom-right corner, kept on the grid at the same place. */
export function resizeRect(rect: GridRect, dw: number, dh: number): GridRect {
  const w = Math.min(Math.max(rect.w + dw, 1), GRID_COLUMNS - rect.x)
  const h = Math.min(Math.max(rect.h + dh, 1), DESIGNER_MAX_ROWS - rect.y)
  return { ...rect, w, h }
}

/** A pointer movement in pixels as whole grid cells, rounded to the nearest cell. */
export function pixelsToCells(
  dxPx: number,
  dyPx: number,
  cellWidth: number,
  rowHeight: number
): { dx: number; dy: number } {
  const cells = (px: number, size: number) => (size > 0 ? Math.round(px / size) : 0)
  // `|| 0` turns -0 into 0
  return { dx: cells(dxPx, cellWidth) || 0, dy: cells(dyPx, rowHeight) || 0 }
}

/** The cell under a point, given its offset from the canvas's top-left corner. */
export function pointToCell(
  xPx: number,
  yPx: number,
  cellWidth: number,
  rowHeight: number
): { x: number; y: number } {
  const cell = (px: number, size: number) => (size > 0 ? Math.floor(px / size) : 0)
  return { x: cell(xPx, cellWidth), y: cell(yPx, rowHeight) }
}

/** Where a new widget of `size` goes: the left edge of the first row below every widget. */
export function nextFreeRect(rects: readonly GridRect[], size: GridSize): GridRect {
  const bottom = rects.reduce((max, r) => Math.max(max, r.y + r.h), 0)
  return clampRect({ x: 0, y: bottom, w: size.w, h: size.h })
}

/** The rects of `widgets` as placed on `breakpoint` (`null` for the base grid). */
export function rectsOn(
  widgets: readonly Pick<Widget, 'grid' | 'breakpoints'>[],
  breakpoint: LayoutBreakpoint | null
): GridRect[] {
  return widgets.map(w => resolveRect(w, breakpoint))
}

/**
 * The `order` changes that move widget `id` one place earlier (`-1`) or later (`1`) in
 * reading order: it swaps places with its neighbour. Empty when it is already at that end.
 */
export function swapOrder(
  widgets: readonly Pick<Widget, 'id' | 'order'>[],
  id: string,
  dir: -1 | 1
): { id: string; order: number }[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order)
  const i = sorted.findIndex(w => w.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return []
  // Renumber so equal orders still swap
  return sorted
    .map((w, k) => ({ id: w.id, order: k === i ? j : k === j ? i : k }))
    .filter(({ id: wid, order }) => sorted.find(w => w.id === wid)?.order !== order)
}

/**
 * One field of a widget config form, read from the config's Zod schema. `label` is the
 * field's description (`.describe()` or `.meta({ description })`), or the key when it has
 * none; a text field with `.meta({ multiline: true })` gets a multi-line box.
 */
export type ConfigField = { key: string; label: string } & (
  | { kind: 'text'; multiline: boolean }
  | { kind: 'number'; min?: number; max?: number }
  | { kind: 'boolean' }
  | { kind: 'choice'; options: string[] }
)

/**
 * Unwrap optional, nullable and default wrappers to the schema that holds the value, with
 * the metadata set on any of them (outer wrappers win).
 */
function inner(schema: z.ZodType): { s: z.ZodType; meta: Record<string, unknown> } {
  let s = schema
  let meta = { ...z.globalRegistry.get(s) }
  while (s instanceof z.ZodOptional || s instanceof z.ZodNullable || s instanceof z.ZodDefault) {
    s = s.unwrap() as z.ZodType
    meta = { ...z.globalRegistry.get(s), ...meta }
  }
  return { s, meta }
}

/**
 * The form fields for a widget config schema: one per text, number, true/false or
 * choice-of-strings key, in the schema's order. Keys of any other kind are left out, so the
 * form never offers what it can't edit; the schema still checks them on save.
 */
export function configFields(schema: z.ZodType): ConfigField[] {
  if (!(schema instanceof z.ZodObject)) return []
  const fields: ConfigField[] = []
  for (const [key, value] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    const { s, meta } = inner(value)
    const label = typeof meta.description === 'string' ? meta.description : key
    if (s instanceof z.ZodString) {
      fields.push({ key, label, kind: 'text', multiline: meta.multiline === true })
    } else if (s instanceof z.ZodBoolean) fields.push({ key, label, kind: 'boolean' })
    else if (s instanceof z.ZodEnum) {
      fields.push({ key, label, kind: 'choice', options: s.options.map(String) })
    } else if (s instanceof z.ZodNumber) {
      fields.push({
        key,
        label,
        kind: 'number',
        ...(Number.isFinite(s.minValue) && { min: s.minValue as number }),
        ...(Number.isFinite(s.maxValue) && { max: s.maxValue as number }),
      })
    }
  }
  return fields
}
