import { Eraser } from 'lucide-react'
import { BuzzerLockButton } from './BuzzerLockButton'
import { BuzzList } from './BuzzList'
import { Button, Icon } from '@/components/ui'
import type { Game, BuzzEvent, GmDecision } from '@/db'

interface BuzzerPanelProps {
  game: Game
  questionId: string | null
  buzzes: BuzzEvent[]
  displayBuzzes: BuzzEvent[]
  onToggleLock: () => void
  onAdjudicate: (buzzId: string, decision: GmDecision) => void
  onClear: () => void
}

/**
 * The full GM buzzer panel — lock button, buzz list, and clear action.
 * Rendered inside ActiveGame as part of the question control area.
 */
export function BuzzerPanel({
  game,
  questionId,
  buzzes,
  displayBuzzes,
  onToggleLock,
  onAdjudicate,
  onClear,
}: BuzzerPanelProps) {
  const pendingCount = displayBuzzes.filter(b => !b.gmDecision).length

  return (
    <div
      className="rounded-xl border flex flex-col gap-4 p-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <BuzzerLockButton
          isLocked={game.buzzerLocked}
          onToggle={onToggleLock}
          disabled={!questionId}
        />

        <div className="flex items-center gap-2">
          {buzzes.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              title="Clear all buzzes for this question"
              style={{ color: 'var(--color-muted)' }}
            >
              <Icon icon={Eraser} size="sm" />
              Clear buzzes
            </Button>
          )}
          {pendingCount > 0 && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{ background: 'var(--color-gold)22', color: 'var(--color-gold)' }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Active settings strip */}
      <div
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
        style={{ color: 'var(--color-muted)' }}
      >
        {game.autoLockOnFirstCorrect && <span>Auto-lock on correct: on</span>}
        {game.allowFalseStarts && <span>False starts: recorded</span>}
        {game.buzzDeduplication === 'all' && <span>Show all buzz attempts</span>}
      </div>

      {/* Buzz list */}
      <BuzzList
        buzzes={displayBuzzes}
        allBuzzes={buzzes}
        onAdjudicate={onAdjudicate}
        showAll={game.buzzDeduplication === 'all'}
      />
    </div>
  )
}
