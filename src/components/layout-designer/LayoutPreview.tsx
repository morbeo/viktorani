import { useLiveQuery } from 'dexie-react-hooks'
import type { Layout, LayoutBreakpoint, Widget } from '@/db'
import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import { loadPreviewSample, samplePlayerData, sampleScreenData } from './sample-data'

interface LayoutPreviewProps {
  layout: Layout
  widgets: Widget[]
  breakpoint: LayoutBreakpoint | null
  /** The game whose question and scores fill the preview; templates use made-up ones. */
  gameId: string | null
}

/**
 * The layout as players or a projector screen would see it, rendered by the real
 * `LayoutRenderer` with sample data. The game master and scoreboard surfaces get their data
 * from the running game page, so they show the editing canvas only.
 */
export function LayoutPreview({ layout, widgets, breakpoint, gameId }: LayoutPreviewProps) {
  const sample = useLiveQuery(() => loadPreviewSample(gameId), [gameId])
  const bundle = { layout, widgets }
  const frame = 'rounded border border-(--color-border) bg-(--color-bg) text-(--color-text)'

  if (layout.target !== 'player' && layout.target !== 'screen') {
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
