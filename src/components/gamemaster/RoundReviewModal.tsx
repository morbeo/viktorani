import { ClipboardCheck, Eye, ListOrdered, Table } from 'lucide-react'
import { Button, Icon, Modal } from '@/components/ui'
import type { GameQuestion, Question } from '@/db'
import type { RoundReviewView } from '@/transport/types'

/** One of the round's questions, as the host reviews it. */
export interface RoundReviewRow {
  gameQuestion: GameQuestion
  question: Question | undefined
}

interface RoundReviewModalProps {
  roundName: string
  view: RoundReviewView
  rows: RoundReviewRow[]
  onViewChange: (view: RoundReviewView) => void
  /** Reveal one question's answer to players and screens. */
  onReveal: (gameQuestionId: string) => void
  onClose: () => void
  /** Close the review and move on; only when it opened on the way to the next round. */
  onContinue?: () => void
  /** Open the round's answer sheet, in a game where players send answers. */
  onMarkAnswers?: () => void
}

const RULING_LABELS: Record<GameQuestion['status'], string> = {
  pending: 'Not ruled',
  correct: 'Correct',
  incorrect: 'Wrong',
  skipped: 'Skipped',
}

const VIEWS: { value: RoundReviewView; label: string; icon: typeof Table }[] = [
  { value: 'list', label: 'One by one', icon: ListOrdered },
  { value: 'table', label: 'Table', icon: Table },
]

/**
 * The end-of-round answer review (ADR 0023): the host sees every answer of the round and
 * reveals them to players and screens one by one, or all at once as a table.
 */
export function RoundReviewModal({
  roundName,
  view,
  rows,
  onViewChange,
  onReveal,
  onClose,
  onContinue,
  onMarkAnswers,
}: RoundReviewModalProps) {
  const hidden = rows.filter(r => !r.gameQuestion.revealed && r.question?.answer)
  const next = hidden[0]

  return (
    <Modal open onClose={onClose} title={`Round answers · ${roundName}`} maxWidth="720px">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show answers">
          {VIEWS.map(v => (
            <Button
              key={v.value}
              size="sm"
              variant={view === v.value ? 'primary' : 'secondary'}
              aria-pressed={view === v.value}
              onClick={() => onViewChange(v.value)}
            >
              <Icon icon={v.icon} size="sm" />
              {v.label}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted">
            {rows.length - hidden.length} of {rows.length} revealed
          </span>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Question</th>
              <th className="py-1 pr-2">Answer</th>
              <th className="py-1 pr-2">Ruling</th>
              <th className="py-1">Shown</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ gameQuestion, question }, i) => (
              <tr key={gameQuestion.id} className="border-t border-border">
                <td className="py-2 pr-2 mono text-muted">{i + 1}</td>
                <td className="py-2 pr-2">{question?.title ?? 'Missing question'}</td>
                <td className="py-2 pr-2 font-medium">{question?.answer || '—'}</td>
                <td className="py-2 pr-2 text-muted">{RULING_LABELS[gameQuestion.status]}</td>
                <td className="py-2">{gameQuestion.revealed ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap justify-end gap-3">
          {onMarkAnswers && (
            <Button variant="secondary" className="mr-auto" onClick={onMarkAnswers}>
              <Icon icon={ClipboardCheck} size="sm" />
              Mark answers
            </Button>
          )}
          {view === 'list' ? (
            <Button
              variant="secondary"
              disabled={!next}
              onClick={() => next && onReveal(next.gameQuestion.id)}
            >
              <Icon icon={Eye} size="sm" />
              {next ? `Reveal answer ${rows.indexOf(next) + 1}` : 'All answers revealed'}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={!next}
              onClick={() => hidden.forEach(r => onReveal(r.gameQuestion.id))}
            >
              <Icon icon={Eye} size="sm" />
              {next ? 'Reveal all answers' : 'All answers revealed'}
            </Button>
          )}
          <Button variant={onContinue ? 'secondary' : 'primary'} onClick={onClose}>
            Close review
          </Button>
          {onContinue && (
            <Button variant="primary" onClick={onContinue}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
