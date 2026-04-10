import type { Question, GameQuestion } from '@/db'
import { Badge } from '@/components/ui'
import { Icon } from '@/components/ui'
import { ListChecks, ToggleLeft, PencilLine } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TYPE_LABEL: Record<Question['type'], string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  open_ended: 'Open ended',
}

const TYPE_COLOR: Record<Question['type'], string> = {
  multiple_choice: '#2563eb',
  true_false: '#7c3aed',
  open_ended: '#0891b2',
}

const TYPE_ICON: Record<Question['type'], LucideIcon> = {
  multiple_choice: ListChecks,
  true_false: ToggleLeft,
  open_ended: PencilLine,
}

const STATUS_LABEL: Record<GameQuestion['status'], string> = {
  pending: 'Pending',
  correct: 'Correct',
  incorrect: 'Incorrect',
  skipped: 'Skipped',
}

const STATUS_COLOR: Record<GameQuestion['status'], string> = {
  pending: '#6b7280',
  correct: '#16a34a',
  incorrect: '#dc2626',
  skipped: '#d97706',
}

interface HostQuestionHeaderProps {
  question: Question
  gameQuestion: GameQuestion
}

export function HostQuestionHeader({ question, gameQuestion }: HostQuestionHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={TYPE_COLOR[question.type]} style={{ color: '#fff' }}>
          <Icon icon={TYPE_ICON[question.type]} size="sm" className="mr-1" />
          {TYPE_LABEL[question.type]}
        </Badge>
        <Badge color={STATUS_COLOR[gameQuestion.status]} style={{ color: '#fff' }}>
          {STATUS_LABEL[gameQuestion.status]}
        </Badge>
      </div>
      <h2
        className="text-xl font-bold leading-snug"
        style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-ink)' }}
      >
        {question.title}
      </h2>
    </div>
  )
}
