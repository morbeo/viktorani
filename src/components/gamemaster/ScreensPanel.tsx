import { useState } from 'react'
import { Button } from '@/components/ui'

export interface ScreensPanelProps {
  roomId: string | null
  /** Connection ids of screens waiting for approval, oldest first. */
  pending: string[]
  /** Connection ids of approved, connected screens, oldest first. */
  connected: string[]
  /** How many spectators are watching (see `Game.allowSpectators`). */
  watching?: number
  onApprove: (connId: string) => void
  onReject: (connId: string) => void
  onDisconnect: (connId: string) => void
}

/**
 * The link for projector screens on other devices, the screens waiting for approval, the
 * screens currently connected, and how many spectators are watching.
 */
export function ScreensPanel({
  roomId,
  pending,
  connected,
  watching = 0,
  onApprove,
  onReject,
  onDisconnect,
}: ScreensPanelProps) {
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
      className="rounded-xl border flex flex-col bg-surface"
      style={{
        borderColor: pending.length > 0 ? 'var(--color-accent)' : 'var(--color-border)',
      }}
    >
      <div className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider border-border text-muted">
        Screens
      </div>
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="flex-1 min-w-0 truncate text-xs mono text-muted" title={url}>
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
      {connected.length > 0 && (
        <ul className="flex flex-col border-t border-border">
          {connected.map((connId, i) => (
            <li key={connId} className="px-4 py-2 flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-sm">Screen {i + 1}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDisconnect(connId)}
                aria-label={`Disconnect screen ${i + 1}`}
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}
      {watching > 0 && (
        <p className="px-4 py-2 border-t border-border text-sm text-muted">
          {watching === 1 ? '1 person watching' : `${watching} people watching`}
        </p>
      )}
    </div>
  )
}
