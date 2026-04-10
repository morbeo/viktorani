import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Icon } from '@/components/ui'
import type { NavPosition } from '@/pages/admin/gamemaster-utils'

interface NavHeaderProps {
  pos: NavPosition
  totalQ: number
  onPrev: () => void
  onNext: () => void
}

/**
 * Navigation header shown during an active game:
 * - Round name + question position label
 * - Progress bar across all questions
 * - Prev / Next buttons (disabled at boundaries)
 */
export function NavHeader({ pos, totalQ, onPrev, onNext }: NavHeaderProps) {
  const progress = totalQ > 1 ? pos.flatIndex / (totalQ - 1) : 1

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
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
            {pos.roundIdx >= 0 ? `Round ${pos.roundIdx + 1}` : ''}
          </span>
          <span className="text-xs shrink-0 mono" style={{ color: 'var(--color-muted)' }}>
            Q {pos.flatIndex + 1} / {totalQ}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--color-border)' }}
          role="progressbar"
          aria-valuenow={pos.flatIndex + 1}
          aria-valuemin={1}
          aria-valuemax={totalQ}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress * 100}%`,
              background: 'var(--color-gold)',
            }}
          />
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
