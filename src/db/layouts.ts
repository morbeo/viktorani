import { db } from './index'
import type { Layout, Widget } from './index'

/**
 * The stored layouts a game can use, each with its widgets: the game's own and the global
 * templates (`gameId: null`), for every target and phase.
 */
export async function loadGameLayouts(
  gameId: string
): Promise<{ layout: Layout; widgets: Widget[] }[]> {
  // Null isn't indexable in IndexedDB, so templates can't be found by the gameId index
  const layouts = await db.layouts.filter(l => l.gameId === gameId || l.gameId === null).toArray()
  const widgets = await db.widgets
    .where('layoutId')
    .anyOf(layouts.map(l => l.id))
    .toArray()
  return layouts.map(layout => ({
    layout,
    widgets: widgets.filter(w => w.layoutId === layout.id),
  }))
}
