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
              borderColor: isCorrect ? '#16a34a' : 'var(--color-border)',
              background: isCorrect ? '#f0fdf4' : 'var(--color-surface)',
              color: isCorrect ? '#15803d' : 'var(--color-ink)',
              outline: isCorrect ? '2px solid #16a34a' : 'none',
              outlineOffset: '-2px',
            }}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: isCorrect ? '#16a34a' : 'var(--color-border)',
                color: isCorrect ? '#fff' : 'var(--color-muted)',
              }}
            >
              {String.fromCharCode(65 + i)}
            </span>
            {option}
            {isCorrect && (
              <span className="ml-auto text-xs font-semibold" style={{ color: '#16a34a' }}>
                ✓ Correct
              </span>
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
              borderColor: isCorrect ? '#16a34a' : 'var(--color-border)',
              background: isCorrect ? '#f0fdf4' : 'var(--color-surface)',
              color: isCorrect ? '#15803d' : 'var(--color-muted)',
              outline: isCorrect ? '2px solid #16a34a' : 'none',
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
    <div
      className="px-4 py-3 rounded-lg border text-sm"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-ink)',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-1"
        style={{ color: 'var(--color-muted)' }}
      >
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
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-muted)' }}
      >
        Answers
      </p>
      {type === 'multiple_choice' && <MultipleChoice options={options} answer={answer} />}
      {type === 'true_false' && <TrueFalse answer={answer} />}
      {type === 'open_ended' && <OpenEnded answer={answer} />}
    </div>
  )
}
