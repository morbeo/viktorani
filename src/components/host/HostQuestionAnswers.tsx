import type { Question } from '@/db'

function MultipleChoice({ options, answer }: { options: string[]; answer: string }) {
  return (
    <ol className="flex flex-col gap-2">
      {options.map((option, i) => {
        const isCorrect = option === answer
        return (
          <li
            key={i}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium"
            style={{
              borderColor: isCorrect ? 'var(--color-positive)' : 'var(--color-border)',
              background: isCorrect
                ? 'color-mix(in srgb, var(--color-positive) 10%, transparent)'
                : 'var(--color-surface)',
              color: isCorrect ? 'var(--color-positive)' : 'var(--color-text)',
              outline: isCorrect ? '2px solid var(--color-positive)' : 'none',
              outlineOffset: '-2px',
            }}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: isCorrect ? 'var(--color-positive)' : 'var(--color-border)',
                color: isCorrect ? 'white' : 'var(--color-muted)',
              }}
            >
              {String.fromCharCode(65 + i)}
            </span>
            {option}
            {isCorrect && (
              <span className="ml-auto text-xs font-semibold text-positive">✓ Correct</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function TrueFalse({ answer }: { answer: string }) {
  return (
    <div className="flex gap-3">
      {(['True', 'False'] as const).map(option => {
        const isCorrect = option === answer
        return (
          <div
            key={option}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-bold"
            style={{
              borderColor: isCorrect ? 'var(--color-positive)' : 'var(--color-border)',
              background: isCorrect
                ? 'color-mix(in srgb, var(--color-positive) 10%, transparent)'
                : 'var(--color-surface)',
              color: isCorrect ? 'var(--color-positive)' : 'var(--color-muted)',
              outline: isCorrect ? '2px solid var(--color-positive)' : 'none',
              outlineOffset: '-2px',
            }}
          >
            {isCorrect && <span>✓</span>}
            {option}
          </div>
        )
      })}
    </div>
  )
}

function OpenEnded({ answer }: { answer: string }) {
  return (
    <div className="px-4 py-3 rounded-lg border text-sm border-border bg-surface text-text">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-muted">
        Expected answer
      </p>
      <p className="font-medium">{answer}</p>
    </div>
  )
}

interface HostQuestionAnswersProps {
  question: Question
}

export function HostQuestionAnswers({ question }: HostQuestionAnswersProps) {
  const { type, options, answer } = question
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Answers</p>
      {type === 'multiple_choice' && <MultipleChoice options={options} answer={answer} />}
      {type === 'true_false' && <TrueFalse answer={answer} />}
      {type === 'open_ended' && <OpenEnded answer={answer} />}
    </div>
  )
}
