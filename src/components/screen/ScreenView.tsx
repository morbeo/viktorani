import type { GamePhase, LayoutAssignments } from '@/db'
import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import { resolveLayout, type LayoutBundle } from '@/widgets/layouts'
import type { ScreenData } from '@/widgets/types'

interface ScreenViewProps {
  data: ScreenData
  /** Stored layouts to choose from; the built-in default is used when none fits. */
  layouts?: readonly LayoutBundle[]
  gameId?: string | null
  phase?: GamePhase | null
  /** The layouts the host chose for the screen, per phase. */
  assignments?: LayoutAssignments
}

/**
 * The projector page: the screen layout for this game and phase, rendered with `data`.
 *
 * @remarks
 * Each visible widget gets the same top margin, and the page has no top padding of its own,
 * so the spacing matches the stacked view this replaced: one gap above every piece that
 * shows, and none for pieces that render nothing.
 */
export function ScreenView({
  data,
  layouts = [],
  gameId = null,
  phase = null,
  assignments,
}: ScreenViewProps) {
  const bundle = resolveLayout(layouts, { target: 'screen', gameId, phase, assignments })
  return (
    <LayoutRenderer
      as="main"
      bundle={bundle}
      target="screen"
      data={data}
      breakpoint="tv"
      className="min-h-screen px-12 pb-10 text-center"
      style={{ background: 'var(--color-cream)', color: 'var(--color-ink)' }}
      cellClassName="mt-10 flex flex-col items-center gap-10"
    />
  )
}
