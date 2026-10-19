import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCheck } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { db } from '@/db'
import type { Answer, GameQuestion, Player, Question, Team } from '@/db'
import { choiceOptions } from '@/db/answers'

interface HostAnswersPanelProps {
  question: Question
  gameQuestion: GameQuestion
  players: Player[]
  teams: Team[]
  disabled?: boolean
  onMark: () => void
}

const RULING_LABELS: Record<Answer['ruling'], string> = {
  pending: '',
  correct: 'Correct',
  incorrect: 'Wrong',
}

/**
 * Players' choices to the question shown, in a game where they pick an option (ADR 0023):
 * who picked what, and once marked, whether they were right. Mark answers scores them and
 * closes the question to new ones; moving on or ruling on the question does the same.
 */
export function HostAnswersPanel({
  question,
  gameQuestion,
  players,
  teams,
  disabled = false,
  onMark,
}: HostAnswersPanelProps) {
  const answers = useLiveQuery(
    () => db.answers.where('gameQuestionId').equals(gameQuestion.id).sortBy('receivedAt'),
    [gameQuestion.id]
  )
  const options = choiceOptions(question)

  if (options.length === 0) {
    return (
      <section aria-label="Answers" className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Answers</span>
        <p className="text-sm text-muted">
          This question has no options to pick from, so players can't answer it on their phones.
          Rule on it below.
        </p>
      </section>
    )
  }

  const nameOf = (a: Answer) =>
    (a.teamId
      ? teams.find(t => t.id === a.teamId)?.name
      : players.find(p => p.id === a.playerId)?.name) ?? 'Unknown'
  const pending = (answers ?? []).filter(a => a.ruling === 'pending').length

  return (
    <section aria-label="Answers" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Answers</span>
        <span className="text-xs text-muted">{answers?.length ?? 0} in</span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={disabled || pending === 0}
          onClick={onMark}
        >
          <Icon icon={CheckCheck} size="sm" />
          Mark answers
        </Button>
      </div>
      {answers && answers.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {answers.map(a => (
            <li key={a.id} className="flex items-center gap-2 text-text">
              <span className="truncate">{nameOf(a)}</span>
              <span className="mono text-muted">{String.fromCharCode(65 + a.choice)}</span>
              <span className="truncate text-muted">{options[a.choice]}</span>
              {a.ruling !== 'pending' && (
                <span
                  className={`ml-auto text-xs font-semibold ${a.ruling === 'correct' ? 'text-positive' : 'text-negative'}`}
                >
                  {RULING_LABELS[a.ruling]}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
