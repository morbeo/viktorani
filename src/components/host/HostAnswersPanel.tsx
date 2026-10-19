import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CheckCheck, Lock, X } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { db } from '@/db'
import type { Answer, GameQuestion, Player, Question, Team } from '@/db'
import { choiceOptions, textMatches } from '@/db/answers'

interface HostAnswersPanelProps {
  /** How players answer: by picking an option, or by typing. */
  inputType: 'choice' | 'text'
  question: Question
  gameQuestion: GameQuestion
  players: Player[]
  teams: Team[]
  disabled?: boolean
  /** Closes the question to new answers, marking choices. */
  onMark: () => void
  /** Marks typed answers right or wrong. */
  onMarkTyped?: (answerIds: string[], ruling: 'correct' | 'incorrect') => void
}

const RULING_LABELS: Record<Answer['ruling'], string> = {
  pending: '',
  correct: 'Correct',
  incorrect: 'Wrong',
}

/**
 * Players' answers to the question shown (ADR 0023): who picked or typed what, and whether
 * they were right. Choices are marked when the question closes: **Mark answers**, a ruling,
 * or moving on. Typed answers are marked by the host, one by one or all that match the
 * correct answer, before or after the question closes.
 */
export function HostAnswersPanel({
  inputType,
  question,
  gameQuestion,
  players,
  teams,
  disabled = false,
  onMark,
  onMarkTyped,
}: HostAnswersPanelProps) {
  const answers = useLiveQuery(
    () => db.answers.where('gameQuestionId').equals(gameQuestion.id).sortBy('receivedAt'),
    [gameQuestion.id]
  )
  const options = choiceOptions(question)

  if (inputType === 'choice' && options.length === 0) {
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
  const list = answers ?? []
  const pending = list.filter(a => a.ruling === 'pending').length
  const open = gameQuestion.status === 'pending'
  const matching = list.filter(
    a => a.ruling === 'pending' && a.text !== null && textMatches(a.text, question.answer)
  )

  return (
    <section aria-label="Answers" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Answers</span>
        <span className="text-xs text-muted">{list.length} in</span>
        <div className="ml-auto flex gap-2">
          {inputType === 'text' && onMarkTyped && (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled || matching.length === 0}
              onClick={() =>
                onMarkTyped(
                  matching.map(a => a.id),
                  'correct'
                )
              }
            >
              <Icon icon={CheckCheck} size="sm" />
              Mark matching correct
            </Button>
          )}
          {inputType === 'choice' ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled || pending === 0}
              onClick={onMark}
            >
              <Icon icon={CheckCheck} size="sm" />
              Mark answers
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled || !open || list.length === 0}
              onClick={onMark}
            >
              <Icon icon={Lock} size="sm" />
              Close answers
            </Button>
          )}
        </div>
      </div>
      {inputType === 'text' && pending > 0 && (
        <p className="text-xs text-muted">
          {pending} to mark. {open ? 'Players can still change their answers.' : ''}
        </p>
      )}
      {list.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {list.map(a => (
            <li key={a.id} className="flex items-center gap-2 text-text">
              <span className="shrink-0 truncate">{nameOf(a)}</span>
              {a.choice !== null ? (
                <>
                  <span className="mono text-muted">{String.fromCharCode(65 + a.choice)}</span>
                  <span className="truncate text-muted">{options[a.choice]}</span>
                </>
              ) : (
                <span className="min-w-0 break-words text-muted">{a.text}</span>
              )}
              {a.text !== null && onMarkTyped ? (
                <span className="ml-auto flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant={a.ruling === 'correct' ? 'secondary' : 'ghost'}
                    aria-label={`Mark ${nameOf(a)} correct`}
                    aria-pressed={a.ruling === 'correct'}
                    disabled={disabled}
                    onClick={() => onMarkTyped([a.id], 'correct')}
                  >
                    <Icon icon={Check} size="sm" />
                  </Button>
                  <Button
                    size="sm"
                    variant={a.ruling === 'incorrect' ? 'secondary' : 'ghost'}
                    aria-label={`Mark ${nameOf(a)} wrong`}
                    aria-pressed={a.ruling === 'incorrect'}
                    disabled={disabled}
                    onClick={() => onMarkTyped([a.id], 'incorrect')}
                  >
                    <Icon icon={X} size="sm" />
                  </Button>
                </span>
              ) : (
                a.ruling !== 'pending' && (
                  <span
                    className={`ml-auto text-xs font-semibold ${a.ruling === 'correct' ? 'text-positive' : 'text-negative'}`}
                  >
                    {RULING_LABELS[a.ruling]}
                  </span>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
