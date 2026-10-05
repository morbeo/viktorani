import { useState } from 'react'
import { X } from 'lucide-react'
import { Icon } from '@/components/ui'
import type { PlayerSession } from './player-session'

/**
 * The host's latest message, dismissible. Stays dismissed until a new message arrives —
 * `message` is a fresh object each time the host sends one, even if the text repeats.
 */
export function AnnouncementBanner({ message }: { message: PlayerSession['message'] }) {
  const [dismissed, setDismissed] = useState<PlayerSession['message']>(null)
  const visible = message !== dismissed ? message : null
  if (!visible) return null

  return (
    <div
      className="w-full max-w-sm flex items-start justify-between gap-3 rounded-lg border px-4 py-3"
      style={{
        borderColor: 'var(--color-gold)',
        background: 'var(--color-gold-light)',
        color: 'var(--color-ink)',
      }}
    >
      <p role="status" className="text-sm whitespace-pre-wrap break-words">
        <span className="font-semibold">From the host: </span>
        {visible.text}
      </p>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={() => setDismissed(visible)}
        className="shrink-0 rounded hover:bg-black/5"
      >
        <Icon icon={X} size="sm" />
      </button>
    </div>
  )
}
