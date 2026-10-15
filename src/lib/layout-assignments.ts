import type { LayoutTarget } from '@/db'
import { PHASE_LABELS } from '@/components/layout-designer/labels'
import { BUILTIN_LAYOUTS, type LayoutBundle } from '@/widgets/layouts'

/**
 * The layouts the host can choose for a game's surfaces (#415); the choices themselves are
 * written by `setLayoutAssignment`.
 */

/** Where a layout the host can choose comes from. */
export type LayoutOrigin = 'game' | 'template' | 'builtin'

export interface LayoutChoice {
  bundle: LayoutBundle
  origin: LayoutOrigin
}

/**
 * The layouts that can be chosen for `target` in `gameId`: the game's own, then the
 * templates, then the built-in defaults, each in list order.
 */
export function layoutChoices(
  stored: readonly LayoutBundle[],
  target: LayoutTarget,
  gameId: string
): LayoutChoice[] {
  const forTarget = (bundles: readonly LayoutBundle[]) =>
    bundles.filter(b => b.layout.target === target).sort((a, b) => a.layout.order - b.layout.order)
  return [
    ...forTarget(stored.filter(b => b.layout.gameId === gameId)).map(bundle => ({
      bundle,
      origin: 'game' as const,
    })),
    ...forTarget(stored.filter(b => b.layout.gameId === null)).map(bundle => ({
      bundle,
      origin: 'template' as const,
    })),
    ...forTarget(BUILTIN_LAYOUTS).map(bundle => ({ bundle, origin: 'builtin' as const })),
  ]
}

/** How a layout is named in the pickers. */
export function choiceLabel({ bundle, origin }: LayoutChoice): string {
  const { name, phase } = bundle.layout
  if (origin === 'builtin') return `Built-in default${phase ? ` (${PHASE_LABELS[phase]})` : ''}`
  return origin === 'template' ? `${name} (template)` : name
}
