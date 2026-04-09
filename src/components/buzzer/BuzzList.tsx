import type { BuzzEvent, GmDecision } from '@/db'
import { Button } from '@/components/ui'

interface BuzzListProps {
  buzzes: BuzzEvent[]
  allBuzzes: BuzzEvent[]
  onAdjudicate: (buzzId: string, decision: GmDecision) => void
  showAll: boolean
}

const TIE_WINDOW_MS = 1 // buzzes within 1ms are "tied"

function elapsedLabel(buzz: BuzzEvent, first: BuzzEvent): string {
  if (buzz.id === first.id) return 'first'
  const ms = buzz.timestamp - first.timestamp
  return `+${ms < 1000 ? ms.toFixed(0) + 'ms' : (ms / 1000).toFixed(2) + 's'}`
}

function isTied(a: BuzzEvent, b: BuzzEvent): boolean {
  return Math.abs(a.timestamp - b.timestamp) <= TIE_WINDOW_MS
}

const RANK_COLORS = [
  { bg: 'var(--color-gold)22', border: 'var(--color-gold)', color: 'var(--color-gold)' },
  { bg: 'var(--color-border)', border: 'var(--color-border)', color: 'var(--color-muted)' },
  { bg: 'var(--color-border)', border: 'var(--color-border)', color: 'var(--color-muted)' },
]

const DECISION_STYLE: Record<GmDecision, React.CSSProperties> = {
  Correct: { background: 'var(--color-green)22', color: 'var(--color-green)' },
  Incorrect: { background: 'var(--color-red)22', color: 'var(--color-red)' },
  Skip: { background: 'var(--color-muted)22', color: 'var(--color-muted)' },
}

export function BuzzList({ buzzes, allBuzzes, onAdjudicate, showAll }: BuzzListProps) {
  if (buzzes.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-10 rounded-xl border"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
      >
        <span className="text-sm">No buzzes yet</span>
      </div>
    )
  }

  const first = buzzes[0]

  return (
    <div className="flex flex-col gap-2">
      {buzzes.map((buzz, idx) => {
        const rankStyle = RANK_COLORS[Math.min(idx, RANK_COLORS.length - 1)]
        const tied = idx > 0 && isTied(buzzes[idx - 1], buzz)
        const isSecondary =
          !showAll &&
          allBuzzes.findIndex(b => b.playerId === buzz.playerId) !== allBuzzes.indexOf(buzz)

        // Count hidden subsequent buzzes from this player
        const hiddenCount = showAll
          ? 0
          : allBuzzes.filter(
              (b, i) =>
                b.playerId === buzz.playerId &&
                i > allBuzzes.findIndex(x => x.playerId === buzz.playerId)
            ).length

        if (isSecondary) return null

        return (
          <div
            key={buzz.id}
            className="rounded-xl border p-4 flex items-center gap-3 transition-all"
            style={{
              borderColor: buzz.isFalseStart
                ? 'var(--color-gold)'
                : buzz.gmDecision
                  ? 'var(--color-border)'
                  : idx === 0
                    ? rankStyle.border
                    : 'var(--color-border)',
              background: buzz.gmDecision
                ? DECISION_STYLE[buzz.gmDecision].background
                : idx === 0
                  ? rankStyle.bg
                  : 'var(--color-surface)',
              opacity: buzz.gmDecision === 'Skip' ? 0.5 : 1,
            }}
          >
            {/* Rank badge */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: rankStyle.bg, color: rankStyle.color }}
            >
              {idx === 0 ? '★' : idx + 1}
            </div>

            {/* Player info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">{buzz.playerName}</span>

                {buzz.isFalseStart && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'var(--color-gold)22', color: 'var(--color-gold)' }}
                  >
                    False Start
                  </span>
                )}
                {tied && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{ background: 'var(--color-muted)22', color: 'var(--color-muted)' }}
                  >
                    Tied
                  </span>
                )}
                {hiddenCount > 0 && (
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    +{hiddenCount} more
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                {elapsedLabel(buzz, first)}
              </div>
            </div>

            {/* Decision or action buttons */}
            {buzz.gmDecision ? (
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={DECISION_STYLE[buzz.gmDecision]}
              >
                {buzz.gmDecision}
              </span>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  onClick={() => onAdjudicate(buzz.id, 'Correct')}
                  style={{
                    background: 'var(--color-green)',
                    color: '#fff',
                    minHeight: 36,
                    minWidth: 36,
                  }}
                  title="Mark correct"
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  onClick={() => onAdjudicate(buzz.id, 'Incorrect')}
                  style={{
                    background: 'var(--color-red)',
                    color: '#fff',
                    minHeight: 36,
                    minWidth: 36,
                  }}
                  title="Mark incorrect"
                >
                  ✗
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAdjudicate(buzz.id, 'Skip')}
                  style={{ minHeight: 36, minWidth: 36 }}
                  title="Skip"
                >
                  ⊘
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
