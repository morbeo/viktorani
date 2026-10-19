import { Button } from '@/components/ui'
import type { PendingAdvance } from '@/hooks/useAutoAdvance'

const REASONS: Record<PendingAdvance['reason'], string> = {
  correct: 'Correct answer.',
  timer: "Time's up.",
}

/** The countdown before the game moves on by itself, with a way to stay (#424). */
export function AutoAdvanceNotice({
  pending,
  onCancel,
}: {
  pending: PendingAdvance
  onCancel: () => void
}) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2 text-sm border-accent bg-accent/15 text-text"
    >
      <span>
        {REASONS[pending.reason]} Next question in{' '}
        <span className="mono font-semibold">{pending.secondsLeft} s</span>
      </span>
      <Button size="sm" variant="secondary" onClick={onCancel}>
        Stay
      </Button>
    </div>
  )
}
