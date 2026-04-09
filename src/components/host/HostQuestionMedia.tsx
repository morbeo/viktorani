import type { Question } from '@/db'

interface HostQuestionMediaProps {
  question: Question
}

export function HostQuestionMedia({ question }: HostQuestionMediaProps) {
  const { media, mediaType } = question
  if (!media || !mediaType) return null

  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-muted)' }}
      >
        Media
      </p>
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        {mediaType === 'image' && (
          <img src={media} alt="Question media" className="w-full max-h-72 object-contain" />
        )}
        {mediaType === 'audio' && (
          <div className="p-4">
            <audio controls src={media} className="w-full">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        {mediaType === 'video' && (
          <video controls src={media} className="w-full max-h-72">
            Your browser does not support the video element.
          </video>
        )}
      </div>
    </div>
  )
}
