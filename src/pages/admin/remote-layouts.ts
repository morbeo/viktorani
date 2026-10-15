import { GameEventSchemas } from '@/transport/messages'
import type { GameEvent, RemoteLayoutTarget } from '@/transport/types'
import { layoutsForPhases, type LayoutBundle } from '@/widgets/layouts'

export type LayoutEvent = Extract<GameEvent, { type: 'LAYOUT' }>

/**
 * The `LAYOUT` the host sends a remote surface: each phase's pick from `stored` (see
 * {@link layoutsForPhases}).
 *
 * @remarks
 * Built to pass the `LAYOUT` schema the surface checks it against. When the logos make it
 * too large they are left out, and when it still doesn't pass (more widgets than the
 * transport allows, say) it carries no layouts, so the surface keeps its built-in default.
 */
export function buildLayoutEvent(
  stored: readonly LayoutBundle[],
  target: RemoteLayoutTarget,
  gameId: string
): LayoutEvent {
  const layouts = layoutsForPhases(stored, target, gameId)
  const event: LayoutEvent = { type: 'LAYOUT', target, gameId, layouts }
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
  console.warn('[GameMaster] Stored layouts are too large to send; remote surfaces use the default')
  return { ...event, layouts: [] }
}
