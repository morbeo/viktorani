import type { Layout, LayoutBreakpoint, Widget } from '@/db'
import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import {
  samplePlayerData,
  sampleScoreboardData,
  sampleScreenData,
  usePreviewSample,
} from './sample-data'

interface LayoutPreviewProps {
  layout: Layout
  widgets: Widget[]
  breakpoint: LayoutBreakpoint | null
  /** The game whose question and scores fill the preview; templates use made-up ones. */
  gameId: string | null
}

/**
 * The layout as players, a projector screen or a scoreboard would see it, rendered by the
 * real `LayoutRenderer` with sample data. The game master's surface gets its data from the
 * running game page, so it shows the editing canvas only.
 */
export function LayoutPreview({ layout, widgets, breakpoint, gameId }: LayoutPreviewProps) {
  const sample = usePreviewSample(gameId)
  const bundle = { layout, widgets }
  const frame = 'rounded border border-(--color-border) bg-(--color-bg) text-(--color-text)'

  if (layout.target === 'gamemaster') {
    return (
      <p className={`${frame} p-6 text-sm text-(--color-muted)`}>
        A live preview isn&apos;t available for this surface yet. Switch back to Edit to arrange its
        widgets.
      </p>
    )
  }
  if (!sample) return null

  return (
    <div aria-label="Preview" role="region" className={`${frame} overflow-hidden`}>
      {layout.target === 'player' ? (
        <LayoutRenderer
          bundle={bundle}
          target="player"
          data={samplePlayerData(sample)}
          breakpoint={breakpoint}
          className="gap-x-4 p-4"
          cellClassName="mt-6 flex flex-col items-center"
        />
      ) : layout.target === 'scoreboard' ? (
        <LayoutRenderer
          bundle={bundle}
          target="scoreboard"
          data={sampleScoreboardData(sample)}
          breakpoint={breakpoint}
          className="px-8 pb-8 text-center"
          cellClassName="mt-8 flex flex-col items-center gap-6"
        />
      ) : (
        <LayoutRenderer
          bundle={bundle}
          target="screen"
          data={sampleScreenData(sample)}
          breakpoint={breakpoint}
          className="px-8 pb-8 text-center"
          cellClassName="mt-8 flex flex-col items-center gap-6"
        />
      )}
    </div>
  )
}
