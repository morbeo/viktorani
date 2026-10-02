import { useState } from 'react'
import { Button } from '@/components/ui'

export interface ScreensPanelProps {
  roomId: string | null
  /** Connection ids of screens waiting for approval, oldest first. */
  pending: string[]
  onApprove: (connId: string) => void
  onReject: (connId: string) => void
}

/** The link for projector screens on other devices, and the screens waiting for approval. */
export function ScreensPanel({ roomId, pending, onApprove, onReject }: ScreensPanelProps) {
  const [copied, setCopied] = useState(false)
  if (!roomId) return null

  const url = `${window.location.origin}${window.location.pathname}#/screen/${roomId}`

  function handleCopy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{
        borderColor: pending.length > 0 ? 'var(--color-gold)' : 'var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <div
        className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
      >
        Screens
      </div>
      <div className="px-4 py-2 flex items-center gap-2">
        <span
          className="flex-1 min-w-0 truncate text-xs mono"
          style={{ color: 'var(--color-muted)' }}
          title={url}
        >
          {url}
        </span>
        <Button size="sm" variant="ghost" onClick={handleCopy} aria-label="Copy screen URL">
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {pending.length > 0 && (
        <ul className="flex flex-col">
          {pending.map((connId, i) => (
            <li key={connId} className="px-4 py-2 flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-sm">Screen {i + 1} wants to join</span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onApprove(connId)}
                aria-label={`Approve screen ${i + 1}`}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(connId)}
                aria-label={`Reject screen ${i + 1}`}
              >
                Reject
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
