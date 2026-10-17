import { HelpTip } from '@/components/ui'
import type { GameQuestion } from '@/db'
import type { NavEntry, NavPosition } from '@/pages/admin/gamemaster-utils'

interface ProgressTrackProps {
  pos: NavPosition
  seq: NavEntry[]
  className?: string
}

/**
 * The round and question count over the progress track, as in the game master's header and
 * the `progress` widget.
 *
 * Progress track:
 *   - One pill per round
 *   - Current round: expanded, shows one circle per question
 *     - active: larger, filled --color-accent
 *     - answered correctly: filled --color-positive
 *     - answered incorrectly: filled --color-negative
 *     - skipped: filled --color-muted
 *     - done without a result: filled --color-positive
 *     - todo: hollow border
 *   - Other rounds: collapsed to a fixed-width pill
 *     - done: --color-positive (dimmed)
 *     - todo: --color-border
 *
 * Uses semantic CSS variables (--color-accent, --color-positive) so the
 * indicator respects any future theme without component changes.
 */
export function ProgressTrack({ pos, seq, className = '' }: ProgressTrackProps) {
  // Build per-round summaries from the flat sequence
  const rounds = buildRoundSummaries(seq)

  return (
    <div className={`flex flex-col gap-2 min-w-0 ${className}`}>
      {/* Label row */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold truncate text-text">
          {pos.roundIdx >= 0 ? `Round ${pos.roundIdx + 1}` : ''}
        </span>
        <span className="flex items-center gap-1.5 text-xs shrink-0 mono text-muted">
          Q {pos.flatIndex + 1} / {seq.length}
          <HelpTip
            label="About the progress track"
            text="One dot per question in this round. Gold: the current question. Green: correct, or passed without a ruling. Red: wrong. Grey: skipped. Hollow: not reached yet. Other rounds are one bar each, green once played."
          />
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface RoundSummary {
  roundId: string
  roundIdx: number
  questionCount: number
  /** Each question's status, in order. */
  statuses: GameQuestion['status'][]
}

const STATUS_COLOR: Record<Exclude<GameQuestion['status'], 'pending'>, string> = {
  correct: 'var(--color-positive)',
  incorrect: 'var(--color-negative)',
  skipped: 'var(--color-muted)',
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
      className="flex items-center gap-1 rounded-full px-2 shrink-0 bg-border"
      style={{
        paddingTop: 4,
        paddingBottom: 4,
        opacity: 1,
      }}
    >
      {Array.from({ length: round.questionCount }, (_, i) => {
        const status = round.statuses[i] ?? 'pending'
        const fill =
          status !== 'pending'
            ? STATUS_COLOR[status]
            : i < questionIdx
              ? 'var(--color-positive)'
              : null
        const active = i === questionIdx

        return (
          <div
            key={i}
            title={status === 'pending' ? undefined : `Question ${i + 1}: ${status}`}
            className="rounded-full transition-all duration-200"
            style={
              active
                ? {
                    width: 10,
                    height: 10,
                    background: 'var(--color-accent)',
                    flexShrink: 0,
                  }
                : fill
                  ? {
                      width: 8,
                      height: 8,
                      background: fill,
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
        statuses: [],
      })
    }
    const summary = seen.get(entry.roundId)!
    summary.questionCount++
    summary.statuses.push(entry.questionStatus)
  }
  return [...seen.values()].sort((a, b) => a.roundIdx - b.roundIdx)
}
