import type { OpenQuestion } from '@/transport/types'
import { ChoicePad, TextPad } from './player-widgets'

/** What this phone last sent for a question: an option's index, or typed text. */
export type SentAnswer = { choice: number } | { text: string }

interface OpenQuestionsProps {
  questions: OpenQuestion[]
  /** What this phone sent so far, by question id. */
  sent: Record<string, SentAnswer>
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
        const mine = sent[q.questionId]
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
                selected={mine && 'choice' in mine ? mine.choice : null}
                enabled={enabled}
                onChoose={choice => onChoose(q.questionId, choice)}
              />
            )}
            {q.acceptsText && (
              <TextPad
                open
                sent={mine && 'text' in mine ? mine.text : null}
                enabled={enabled}
                onSend={text => onSendText(q.questionId, text)}
              />
            )}
          </section>
        )
      })}
    </section>
  )
}
