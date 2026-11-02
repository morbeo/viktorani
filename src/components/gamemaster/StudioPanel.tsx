import type { Game, GamePhase } from '@/db'
import { Button } from '@/components/ui'
import { PHASE_LABELS } from '@/components/layout-designer/labels'
import { sampleScreenData, usePreviewSample } from '@/components/layout-designer/sample-data'
import { programPhase } from '@/lib/studio'
import type { StudioState, StudioTransition } from '@/lib/studio'
import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import { resolveLayout, type LayoutBundle } from '@/widgets/layouts'

interface StudioPanelProps {
  game: Pick<Game, 'id' | 'layoutAssignments'>
  /** Stored layouts, to name and sketch the screen layout of each phase. */
  layouts: readonly LayoutBundle[]
  /** The phase the game is in, after the GM's override: what a take puts on the screens. */
  live: GamePhase
  /** Studio mode, or `null` when off. */
  studio: StudioState | null
  onStudio: (state: StudioState | null) => void
}

/** A small sketch of the projector layout for `phase`, filled with sample data. */
function Monitor({
  label,
  phase,
  bundle,
  gameId,
}: {
  label: string
  phase: GamePhase
  bundle: LayoutBundle
  gameId: string
}) {
  const sample = usePreviewSample(gameId)
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-xs text-(--color-muted)">
        {label}: <span className="text-(--color-text)">{PHASE_LABELS[phase]}</span>
        {' · '}
        {bundle.layout.name}
      </figcaption>
      {/* Drawn at TV width and scaled to a fifth; hidden from assistive tech, the caption
          says what it shows */}
      <div className="h-28 w-48 overflow-hidden rounded border border-(--color-border) bg-(--color-bg)">
        {sample && (
          <div
            aria-hidden="true"
            className="pointer-events-none w-[960px] origin-top-left scale-[0.2] text-center text-(--color-text)"
          >
            <LayoutRenderer
              bundle={bundle}
              target="screen"
              data={sampleScreenData(sample)}
              breakpoint="tv"
              className="px-8 pb-8"
              cellClassName="mt-8 flex flex-col items-center gap-6"
            />
          </div>
        )}
      </div>
    </figure>
  )
}

/**
 * Studio mode (ADR 0025): the screens keep the layout on air while the game moves on, and
 * the GM takes the next one with a cut or a fade. Phones and this window follow the game.
 */
export function StudioPanel({ game, layouts, live, studio, onStudio }: StudioPanelProps) {
  const on = studio !== null
  const program = programPhase(live, studio)
  const layoutFor = (phase: GamePhase) =>
    resolveLayout(layouts, {
      target: 'screen',
      gameId: game.id,
      phase,
      assignments: game.layoutAssignments?.screen,
    })
  const take = (transition: StudioTransition) => onStudio({ program: live, transition })
  const same = program === live

  return (
    <section aria-label="Studio mode" className="flex flex-col items-end gap-2">
      <label className="flex items-center gap-2 text-xs text-(--color-muted) cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onStudio(on ? null : { program: live, transition: 'cut' })}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-all ${
            on ? 'bg-(--color-accent)' : 'bg-(--color-border)'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
              on ? 'left-[1.1rem]' : 'left-[0.1rem]'
            }`}
          />
        </button>
        Studio mode
      </label>
      {on && (
        <div className="flex flex-wrap items-end justify-end gap-3">
          <Monitor label="On screen" phase={program} bundle={layoutFor(program)} gameId={game.id} />
          <Monitor label="Next" phase={live} bundle={layoutFor(live)} gameId={game.id} />
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={() => take('cut')} disabled={same}>
              Cut
            </Button>
            <Button size="sm" variant="primary" onClick={() => take('fade')} disabled={same}>
              Fade
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
