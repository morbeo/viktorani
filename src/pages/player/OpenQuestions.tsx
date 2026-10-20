import type { OpenQuestion } from '@/transport/types'
import { ChoicePad, TextPad } from './player-widgets'
import { teamAnswerView } from './team-answer'
import type { TeamAnswers } from './team-answer'

/** What this phone last sent for a question: an option's index, or typed text. */
export type SentAnswer = { choice: number } | { text: string }

interface OpenQuestionsProps {
  questions: OpenQuestion[]
  /** What this phone sent so far, by question id. */
  sent: Record<string, SentAnswer>
  /** The team's answering mode and answers, in a team game; else `null`. */
  team?: TeamAnswers | null
  playerId?: string | null
  enabled: boolean
  onChoose: (questionId: string, choice: number) => void
  onSendText: (questionId: string, text: string) => void
}

/**
 * The round's earlier questions the player can still answer, in a game that keeps answers
 * open until the end of the round: each with its number, its title when the host shows it,
 * and an answer pad, like a paper answer sheet. Hidden when there are none.
 */
export function OpenQuestions({
  questions,
  sent,
  team = null,
  playerId = null,
  enabled,
  onChoose,
  onSendText,
}: OpenQuestionsProps) {
  if (questions.length === 0) return null
  return (
    <section aria-label="Earlier questions" className="w-full max-w-sm flex flex-col gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
        Still open this round
      </h2>
      {questions.map(q => {
        const view = teamAnswerView(team, q.questionId, playerId, sent[q.questionId])
        return (
          <section
            key={q.questionId}
            aria-label={`Question ${q.number}`}
            className="flex flex-col gap-2 rounded-xl border border-border p-3"
          >
            <p className="text-sm font-medium text-text">
              <span className="mono mr-2 text-muted">#{q.number}</span>
              {q.title ?? `Question ${q.number}`}
            </p>
            {q.choices !== null && (
              <ChoicePad
                count={q.choices}
                options={q.options}
                selected={view.choice}
                enabled={enabled && view.canAnswer}
                note={view.note}
                onChoose={choice => onChoose(q.questionId, choice)}
              />
            )}
            {q.acceptsText && (
              <TextPad
                open
                sent={view.text}
                enabled={enabled && view.canAnswer}
                note={view.note}
                onSend={text => onSendText(q.questionId, text)}
              />
            )}
          </section>
        )
      })}
    </section>
  )
}
