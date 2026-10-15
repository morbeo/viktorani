import { db } from './index'
import type { GamePhase, GridRect, Layout, LayoutTarget, Widget, WidgetType } from './index'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'

/**
 * Writes the layout designer (#412) makes. Each is one Dexie write (or one transaction), so
 * every surface reading layouts sees the change at once.
 */

/** Create an empty layout for `target`: the game's own when `gameId` is set, else a template. */
export async function createLayout(input: {
  gameId: string | null
  target: LayoutTarget
  phase: GamePhase | null
  name: string
}): Promise<Layout> {
  const siblings = await db.layouts.filter(l => l.gameId === input.gameId).toArray()
  const layout: Layout = {
    id: crypto.randomUUID(),
    ...input,
    theme: { ...DEFAULT_LAYOUT_THEME },
    isActive: true,
    order: siblings.reduce((max, l) => Math.max(max, l.order + 1), 0),
  }
  await db.layouts.add(layout)
  return layout
}

/** Change a layout's name, phase, theme or active flag. */
export async function updateLayout(
  id: string,
  patch: Partial<Pick<Layout, 'name' | 'phase' | 'theme' | 'isActive'>>
): Promise<void> {
  await db.layouts.update(id, patch)
}

/** Delete a layout and its widgets together. */
export async function deleteLayout(id: string): Promise<void> {
  await db.transaction('rw', db.layouts, db.widgets, async () => {
    await db.widgets.where('layoutId').equals(id).delete()
    await db.layouts.delete(id)
  })
}

/** Add a widget at `grid`, last in reading order, with its type's default config. */
export async function addWidget(input: {
  layoutId: string
  type: WidgetType
  grid: GridRect
  config: Record<string, unknown>
}): Promise<Widget> {
  const siblings = await db.widgets.where('layoutId').equals(input.layoutId).toArray()
  const widget: Widget = {
    id: crypto.randomUUID(),
    ...input,
    breakpoints: {},
    order: siblings.reduce((max, w) => Math.max(max, w.order + 1), 0),
  }
  await db.widgets.add(widget)
  return widget
}

/** Change a widget's placement, overrides or config. */
export async function updateWidget(
  id: string,
  patch: Partial<Pick<Widget, 'grid' | 'breakpoints' | 'config'>>
): Promise<void> {
  await db.widgets.update(id, patch)
}

/** Apply several `order` changes at once, e.g. two widgets swapping places. */
export async function reorderWidgets(changes: { id: string; order: number }[]): Promise<void> {
  await db.transaction('rw', db.widgets, async () => {
    for (const { id, order } of changes) await db.widgets.update(id, { order })
  })
}

/** Delete one widget. */
export async function deleteWidget(id: string): Promise<void> {
  await db.widgets.delete(id)
}
