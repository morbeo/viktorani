import type { GamePhase, LayoutAssignments } from '@/db'
import { useAppTheme } from '@/hooks/useAppTheme'
import type { StudioSpeed, StudioTransition } from '@/lib/studio'
import { PhaseTransition } from '@/components/screen/PhaseTransition'
import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import { resolveLayout, type LayoutBundle } from '@/widgets/layouts'
import type { ScoreboardData } from '@/widgets/types'

interface ScoreboardViewProps {
  data: ScoreboardData
  /** Stored layouts to choose from; the built-in default is used when none fits. */
  layouts?: readonly LayoutBundle[]
  gameId?: string | null
  phase?: GamePhase | null
  /** How the phase reached this surface: a studio-mode take's transition (ADR 0025). */
  transition?: StudioTransition
  /** How fast that transition plays. */
  speed?: StudioSpeed
  /** The layouts the host chose for the scoreboard, per phase. */
  assignments?: LayoutAssignments
}

/**
 * The scoreboard page: the scoreboard layout for this game and phase, rendered with `data`.
 * Spaced like the projector page, one gap above every widget that shows.
 */
export function ScoreboardView({
  data,
  layouts = [],
  gameId = null,
  phase = null,
  transition = 'cut',
  speed = 'normal',
  assignments,
}: ScoreboardViewProps) {
  const bundle = resolveLayout(layouts, { target: 'scoreboard', gameId, phase, assignments })
  // A layout's own logo replaces the theme's wordmark
  const { logo } = useAppTheme()
  return (
    <PhaseTransition phase={phase} transition={transition} speed={speed}>
      <LayoutRenderer
        as="main"
        bundle={bundle}
        target="scoreboard"
        data={data}
        breakpoint="tv"
        logo={logo.wordmark}
        className="min-h-screen px-12 pb-10 text-center bg-bg text-text"
        cellClassName="mt-10 flex flex-col items-center gap-10"
      />
    </PhaseTransition>
  )
}
