import type { RoundAnswerItem, RoundAnswers } from '@/transport/types'

const RESULTS: Record<RoundAnswerItem['status'], string> = {
  pending: '—',
  correct: 'Correct',
  incorrect: 'Wrong',
  skipped: 'Skipped',
}

const SIZES = {
  phone: { section: 'max-w-sm gap-3 p-5', title: 'text-xl', body: 'text-sm' },
  tv: { section: 'max-w-5xl gap-6 p-10', title: 'text-5xl', body: 'text-3xl' },
}

/**
 * The answers the host has revealed in an end-of-round review (ADR 0023): a numbered list
 * that grows one answer at a time, or a table of the round. Text renders as plain text.
 */
export function RoundAnswersView({
  review,
  size,
}: {
  review: RoundAnswers
  size: keyof typeof SIZES
}) {
  const s = SIZES[size]
  return (
    <section
      aria-label="Round answers"
      className={`w-full flex flex-col rounded-2xl border border-border bg-surface text-left ${s.section}`}
    >
      <h2 className={`font-bold font-display text-text ${s.title}`}>{review.roundName}: answers</h2>
      {review.items.length === 0 && <p className={`text-muted ${s.body}`}>Answers coming up…</p>}

      {review.view === 'list' && review.items.length > 0 && (
        <ol className={`flex flex-col gap-2 ${s.body}`}>
          {review.items.map(item => (
            <li key={item.questionId} className="flex gap-3">
              <span className="mono text-muted">{item.number}</span>
              <span className="flex flex-col">
                {item.title && <span className="text-muted">{item.title}</span>}
                <span className="font-semibold text-positive">{item.answer}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {review.view === 'table' && review.items.length > 0 && (
        <table className={`w-full ${s.body}`}>
          <thead className="text-muted">
            <tr>
              <th className="pr-3 text-left font-normal">#</th>
              <th className="pr-3 text-left font-normal">Question</th>
              <th className="pr-3 text-left font-normal">Answer</th>
              <th className="text-left font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {review.items.map(item => (
              <tr key={item.questionId} className="border-t border-border">
                <td className="py-1 pr-3 mono text-muted">{item.number}</td>
                <td className="py-1 pr-3">{item.title ?? ''}</td>
                <td className="py-1 pr-3 font-semibold text-positive">{item.answer}</td>
                <td className="py-1 text-muted">{RESULTS[item.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
