import { GameEventSchemas } from '@/transport/messages'
import type { LayoutAssignments } from '@/db'
import type { GameEvent, RemoteLayoutTarget } from '@/transport/types'
import { layoutsForPhases, type LayoutBundle } from '@/widgets/layouts'

export type LayoutEvent = Extract<GameEvent, { type: 'LAYOUT' }>

/**
 * The `LAYOUT` the host sends a remote surface: each phase's pick from `stored` (see
 * {@link layoutsForPhases}), and the layouts the host chose for the surface.
 *
 * @remarks
 * Built to pass the `LAYOUT` schema the surface checks it against. When inlined images make
 * it too large, the logos are left out, then if need be the `data:` addresses of image
 * widgets, which then show nothing. When it still doesn't pass (more widgets
 * than the transport allows, say) it carries no layouts, so the surface keeps its built-in
 * default.
 */
export function buildLayoutEvent(
  stored: readonly LayoutBundle[],
  target: RemoteLayoutTarget,
  gameId: string,
  assignments: LayoutAssignments = {}
): LayoutEvent {
  const layouts = layoutsForPhases(stored, target, gameId, assignments)
  const event: LayoutEvent = { type: 'LAYOUT', target, gameId, layouts, assignments }
  if (GameEventSchemas.LAYOUT.safeParse(event).success) return event
  const withoutLogos: LayoutEvent = {
    ...event,
    layouts: layouts.map(b => ({
      ...b,
      layout: { ...b.layout, theme: { ...b.layout.theme, logo: null } },
    })),
  }
  if (GameEventSchemas.LAYOUT.safeParse(withoutLogos).success) {
    console.warn('[GameMaster] Layout logos are too large to send; leaving them out')
    return withoutLogos
  }
  const withoutImages: LayoutEvent = {
    ...withoutLogos,
    layouts: withoutLogos.layouts.map(b => ({
      ...b,
      widgets: b.widgets.map(w =>
        w.type === 'image' && String(w.config.src ?? '').startsWith('data:')
          ? { ...w, config: { ...w.config, src: '' } }
          : w
      ),
    })),
  }
  if (GameEventSchemas.LAYOUT.safeParse(withoutImages).success) {
    console.warn('[GameMaster] Layout images are too large to send; leaving them out')
    return withoutImages
  }
  console.warn('[GameMaster] Stored layouts are too large to send; remote surfaces use the default')
  return { ...event, layouts: [], assignments: {} }
}
