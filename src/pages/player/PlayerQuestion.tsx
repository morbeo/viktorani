import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkDefinitionList, defListHastHandlers } from 'remark-definition-list'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import type { QuestionContent } from './player-session'

type MediaType = NonNullable<QuestionContent['mediaType']>

/**
 * Whether host-sent media may be used as a source: a data URL of the announced kind
 * or a remote https URL. Anything else (javascript:, http:, other data types) is dropped.
 */
export function isSafeMedia(src: string, type: MediaType): boolean {
  return src.startsWith(`data:${type}/`) || src.startsWith('https://')
}

/** The question as far as the host lets players see it: title, description, options, media. */
export function PlayerQuestion({ question }: { question: QuestionContent }) {
  const { title, description, options, media, mediaType } = question
  const safeMedia = media && mediaType && isSafeMedia(media, mediaType) ? media : null

  if (!title && !description && !options && !safeMedia) return null

  return (
    <section
      aria-label="Question"
      className="w-full max-w-sm flex flex-col gap-4 rounded-2xl border p-5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {title && (
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>
          {title}
        </h2>
      )}

      {description && (
        <div className="note-prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkDefinitionList]}
            remarkRehypeOptions={{ handlers: defListHastHandlers }}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
          >
            {description}
          </ReactMarkdown>
        </div>
      )}

      {safeMedia && mediaType === 'image' && (
        <img src={safeMedia} alt="Question media" className="w-full max-h-72 object-contain" />
      )}
      {safeMedia && mediaType === 'audio' && (
        <audio controls src={safeMedia} className="w-full">
          Your browser does not support the audio element.
        </audio>
      )}
      {safeMedia && mediaType === 'video' && (
        <video controls src={safeMedia} className="w-full max-h-72">
          Your browser does not support the video element.
        </video>
      )}

      {options && (
        <ol className="flex flex-col gap-2">
          {options.map((option, i) => (
            <li
              key={i}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink)' }}
            >
              <span className="mono mr-2" style={{ color: 'var(--color-muted)' }}>
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
