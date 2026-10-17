import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Icon, useControlSizeStep, pickBySize } from '@/components/ui'
import { ProgressTrack } from '@/components/ProgressTrack'
import type { NavEntry, NavPosition } from '@/pages/admin/gamemaster-utils'

interface NavHeaderProps {
  pos: NavPosition
  seq: NavEntry[]
  onPrev: () => void
  onNext: () => void
}

/** Navigation header shown during an active game: previous, the progress track, next. */
export function NavHeader({ pos, seq, onPrev, onNext }: NavHeaderProps) {
  const arrowSize = pickBySize(useControlSizeStep(), ['w-6 h-6', 'w-8 h-8', 'w-10 h-10'] as const)

  return (
    <div className="px-6 py-3 border-b flex items-center gap-4 border-border bg-surface">
      {/* Prev */}
      <button
        onClick={onPrev}
        disabled={pos.isFirst}
        aria-label="Previous question"
        title="Previous question (←)"
        className={`${arrowSize} rounded flex items-center justify-center transition-all hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed shrink-0`}
        style={{ color: 'var(--color-text)' }}
      >
        <Icon icon={ChevronLeft} size="md" />
      </button>

      {/* Centre: label + progress */}
      <ProgressTrack pos={pos} seq={seq} className="flex-1" />

      {/* Next */}
      <button
        onClick={onNext}
        disabled={pos.isLast}
        aria-label="Next question"
        title="Next question (→)"
        className={`${arrowSize} rounded flex items-center justify-center transition-all hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed shrink-0`}
        style={{ color: 'var(--color-text)' }}
      >
        <Icon icon={ChevronRight} size="md" />
      </button>
    </div>
  )
}
