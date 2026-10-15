import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkDefinitionList, defListHastHandlers } from 'remark-definition-list'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import type { GameEvent, LogEntry, ScoreboardRow } from '@/transport/types'
import { LOG_KIND_LABELS } from '@/lib/game-log-rows'
import type { ScreenData, WidgetProps } from '@/widgets/types'

/**
 * The projector screen's pieces, each usable on its own, plus the widget adapters the
 * registry renders them through on the `screen` target.
 */

type QuestionContent = Extract<GameEvent, { type: 'QUESTION_CONTENT' }>
type ScreenWidgetProps = WidgetProps<ScreenData>

/** The line above the question, e.g. the round and question number. */
export function ScreenHeading({ heading }: { heading: string | null }) {
  if (!heading) return null
  return (
    <p className="text-2xl" style={{ color: 'var(--color-muted)' }}>
      {heading}
    </p>
  )
}

/** The host's message to the screens. Renders nothing when there isn't one. */
export function ScreenAnnouncement({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p
      role="status"
      className="w-full max-w-5xl rounded-2xl px-10 py-6 text-4xl font-semibold whitespace-pre-wrap break-words"
      style={{ background: 'var(--color-ink)', color: 'var(--color-cream)' }}
    >
      {message}
    </p>
  )
}

/** The current question's title and description. Renders nothing when both are hidden. */
export function ScreenQuestion({ content }: { content: QuestionContent | null }) {
  return (
    <>
      {content?.title && (
        <h1 className="text-6xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
          {content.title}
        </h1>
      )}

      {content?.description && (
        <div className="note-prose text-3xl max-w-4xl">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkDefinitionList]}
            remarkRehypeOptions={{ handlers: defListHastHandlers }}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
          >
            {content.description}
          </ReactMarkdown>
        </div>
      )}
    </>
  )
}

/** The current question's media. Renders nothing when it's hidden. */
export function ScreenMedia({ content }: { content: QuestionContent | null }) {
  return (
    <>
      {content?.media && content.mediaType === 'image' && (
        <img src={content.media} alt="Question media" className="max-h-[50vh] object-contain" />
      )}
      {content?.media && content.mediaType === 'audio' && (
        <audio controls src={content.media} className="w-full max-w-2xl" />
      )}
      {content?.media && content.mediaType === 'video' && (
        <video controls src={content.media} className="max-h-[50vh]" />
      )}
    </>
  )
}

/** The current question's answer options. Renders nothing when they're hidden. */
export function ScreenAnswers({ content }: { content: QuestionContent | null }) {
  if (!content?.options) return null
  return (
    <ol className="grid grid-cols-2 gap-4 w-full max-w-4xl text-3xl text-left">
      {content.options.map((option, i) => (
        <li
          key={i}
          className="rounded-xl border px-6 py-4"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <span className="mono mr-4" style={{ color: 'var(--color-muted)' }}>
            {String.fromCharCode(65 + i)}
          </span>
          {option}
        </li>
      ))}
    </ol>
  )
}

/** Ranked names and scores. Renders nothing for an empty list. */
export function ScreenScores({ rows }: { rows: ScoreboardRow[] }) {
  if (rows.length === 0) return null

  return (
    <ol className="w-full max-w-3xl flex flex-col gap-2">
      {rows.map(r => (
        <li key={r.id} className="flex items-baseline justify-between gap-6 text-3xl">
          <span className="truncate">{r.name}</span>
          <span className="mono font-bold tabular-nums">{r.score}</span>
        </li>
      ))}
    </ol>
  )
}

/** A live feed of recent public game events, newest first. Renders nothing for an empty list. */
export function ScreenLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return null

  return (
    <ul className="w-full max-w-3xl flex flex-col gap-1 text-left">
      {entries.map(e => (
        <li key={e.id} className="text-lg" style={{ color: 'var(--color-muted)' }}>
          <span style={{ color: 'var(--color-ink)' }}>{LOG_KIND_LABELS[e.kind]}</span>
          {e.who && ` · ${e.who}`}
          {e.details && ` · ${e.details}`}
        </li>
      ))}
    </ul>
  )
}

// ── Widget adapters (registry `screen` components) ───────────────────────────

export function ScreenAnnouncementWidget({ data }: ScreenWidgetProps) {
  return <ScreenAnnouncement message={data.message} />
}

export function ScreenHeadingWidget({ data }: ScreenWidgetProps) {
  return <ScreenHeading heading={data.heading} />
}

export function ScreenQuestionWidget({ data }: ScreenWidgetProps) {
  return <ScreenQuestion content={data.content} />
}

export function ScreenMediaWidget({ data }: ScreenWidgetProps) {
  return <ScreenMedia content={data.content} />
}

export function ScreenAnswersWidget({ data }: ScreenWidgetProps) {
  return <ScreenAnswers content={data.content} />
}

export function ScreenTimersWidget({ data }: ScreenWidgetProps) {
  return <>{data.timers}</>
}

export function ScreenScoresWidget({ data }: ScreenWidgetProps) {
  return <ScreenScores rows={data.rows} />
}

export function ScreenLogWidget({ data }: ScreenWidgetProps) {
  return <ScreenLog entries={data.logEntries} />
}
