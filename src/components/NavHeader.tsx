import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import type { NavEntry, NavPosition } from '@/pages/admin/gamemaster-utils'

interface NavHeaderProps {
  pos: NavPosition
  seq: NavEntry[]
  onPrev: () => void
  onNext: () => void
}

/**
 * Navigation header shown during an active game.
 *
 * Progress track:
 *   - One pill per round
 *   - Current round: expanded, shows one circle per question
 *     - done: filled --color-positive
 *     - active: larger, filled --color-accent
 *     - todo: hollow border
 *   - Other rounds: collapsed to a fixed-width pill
 *     - done: --color-positive (dimmed)
 *     - todo: --color-border
 *
 * Uses semantic CSS variables (--color-accent, --color-positive) so the
 * indicator respects any future theme without component changes.
 */
export function NavHeader({ pos, seq, onPrev, onNext }: NavHeaderProps) {
  // Build per-round summaries from the flat sequence
  const rounds = buildRoundSummaries(seq)

  return (
    <div
      className="px-6 py-3 border-b flex items-center gap-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {/* Prev */}
      <button
        onClick={onPrev}
        disabled={pos.isFirst}
        aria-label="Previous question"
        className="w-8 h-8 rounded flex items-center justify-center transition-all hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        style={{ color: 'var(--color-ink)' }}
      >
        <Icon icon={ChevronLeft} size="md" />
      </button>

      {/* Centre: label + progress */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Label row */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
            {pos.roundIdx >= 0 ? `Round ${pos.roundIdx + 1}` : ''}
          </span>
          <span className="text-xs shrink-0 mono" style={{ color: 'var(--color-muted)' }}>
            Q {pos.flatIndex + 1} / {seq.length}
          </span>
        </div>

        {/* Progress track */}
        <div
          className="flex items-center gap-1"
          role="progressbar"
          aria-valuenow={pos.flatIndex + 1}
          aria-valuemin={1}
          aria-valuemax={seq.length}
          aria-label={`Question ${pos.flatIndex + 1} of ${seq.length}`}
        >
          {rounds.map(round => {
            const isCurrent = round.roundIdx === pos.roundIdx

            if (isCurrent) {
              return (
                <ActiveRoundPill key={round.roundId} round={round} questionIdx={pos.questionIdx} />
              )
            }

            return <CollapsedRoundPill key={round.roundId} done={round.roundIdx < pos.roundIdx} />
          })}
        </div>
      </div>

      {/* Next */}
      <button
        onClick={onNext}
        disabled={pos.isLast}
        aria-label="Next question"
        className="w-8 h-8 rounded flex items-center justify-center transition-all hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        style={{ color: 'var(--color-ink)' }}
      >
        <Icon icon={ChevronRight} size="md" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface RoundSummary {
  roundId: string
  roundIdx: number
  questionCount: number
}

function CollapsedRoundPill({ done }: { done: boolean }) {
  return (
    <div
      className="h-2 rounded-full shrink-0 transition-colors duration-200"
      style={{
        width: 20,
        background: done ? 'var(--color-positive)' : 'var(--color-border)',
        opacity: done ? 0.45 : 0.7,
      }}
    />
  )
}

function ActiveRoundPill({ round, questionIdx }: { round: RoundSummary; questionIdx: number }) {
  return (
    <div
      className="flex items-center gap-1 rounded-full px-2 shrink-0"
      style={{
        paddingTop: 4,
        paddingBottom: 4,
        background: 'var(--color-border)',
        opacity: 1,
      }}
    >
      {Array.from({ length: round.questionCount }, (_, i) => {
        const done = i < questionIdx
        const active = i === questionIdx

        return (
          <div
            key={i}
            className="rounded-full transition-all duration-200"
            style={
              active
                ? {
                    width: 10,
                    height: 10,
                    background: 'var(--color-accent)',
                    flexShrink: 0,
                  }
                : done
                  ? {
                      width: 8,
                      height: 8,
                      background: 'var(--color-positive)',
                      flexShrink: 0,
                    }
                  : {
                      width: 8,
                      height: 8,
                      background: 'transparent',
                      border: '1.5px solid var(--color-muted)',
                      flexShrink: 0,
                      opacity: 0.5,
                    }
            }
          />
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildRoundSummaries(seq: NavEntry[]): RoundSummary[] {
  const seen = new Map<string, RoundSummary>()
  for (const entry of seq) {
    if (!seen.has(entry.roundId)) {
      seen.set(entry.roundId, {
        roundId: entry.roundId,
        roundIdx: entry.roundIdx,
        questionCount: 0,
      })
    }
    seen.get(entry.roundId)!.questionCount++
  }
  return [...seen.values()].sort((a, b) => a.roundIdx - b.roundIdx)
}
