import { db } from './index'
import type { GamePhase, GridRect, Layout, LayoutTarget, Widget, WidgetType } from './index'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import { clampRect } from '@/lib/layout-designer'
import type { LayoutBundle } from '@/widgets/layouts'

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

/**
 * Copy `source` (a stored layout, a template or a built-in one) with all its widgets into
 * `gameId`'s layouts, or into the templates when `gameId` is `null`, optionally for another
 * phase. The copy gets new ids and goes last in the list; the source is left as it was.
 */
export async function copyLayout(
  source: LayoutBundle,
  {
    gameId,
    name,
    phase = source.layout.phase,
  }: { gameId: string | null; name: string; phase?: GamePhase | null }
): Promise<Layout> {
  return db.transaction('rw', db.layouts, db.widgets, async () => {
    const siblings = await db.layouts.filter(l => l.gameId === gameId).toArray()
    const layout: Layout = {
      ...source.layout,
      id: crypto.randomUUID(),
      gameId,
      name,
      phase,
      theme: { ...source.layout.theme },
      order: siblings.reduce((max, l) => Math.max(max, l.order + 1), 0),
    }
    await db.layouts.add(layout)
    await db.widgets.bulkAdd(
      source.widgets.map(w => ({
        ...w,
        id: crypto.randomUUID(),
        layoutId: layout.id,
        config: structuredClone(w.config),
        breakpoints: structuredClone(w.breakpoints),
      }))
    )
    return layout
  })
}

/** A stored layout with its widgets, or `null` when it no longer exists. */
export async function loadLayoutBundle(id: string): Promise<LayoutBundle | null> {
  const layout = await db.layouts.get(id)
  if (!layout) return null
  return { layout, widgets: await db.widgets.where('layoutId').equals(id).toArray() }
}

/**
 * Put a layout and its widgets back exactly as in `bundle`, for undo and redo: widgets added
 * since are removed, removed ones come back.
 */
export async function restoreLayout(bundle: LayoutBundle): Promise<void> {
  await db.transaction('rw', db.layouts, db.widgets, async () => {
    await db.widgets.where('layoutId').equals(bundle.layout.id).delete()
    await db.layouts.put(bundle.layout)
    await db.widgets.bulkPut(bundle.widgets)
  })
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

/**
 * Copy a widget just below the original, last in reading order. Its phone and TV
 * placements are copied as they are.
 */
export async function duplicateWidget(id: string): Promise<Widget | null> {
  const source = await db.widgets.get(id)
  if (!source) return null
  const siblings = await db.widgets.where('layoutId').equals(source.layoutId).toArray()
  const widget: Widget = {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    grid: clampRect({ ...source.grid, y: source.grid.y + source.grid.h }),
    order: siblings.reduce((max, w) => Math.max(max, w.order + 1), 0),
  }
  await db.widgets.add(widget)
  return widget
}

/** Delete one widget. */
export async function deleteWidget(id: string): Promise<void> {
  await db.widgets.delete(id)
}
