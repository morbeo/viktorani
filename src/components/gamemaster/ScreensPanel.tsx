import { useState } from 'react'
import { Button } from '@/components/ui'

export interface ScreensPanelProps {
  roomId: string | null
  /** Connection ids of screens waiting for approval, oldest first. */
  pending: string[]
  /** Connection ids of approved, connected screens, oldest first. */
  connected: string[]
  /** Connection ids, pending or connected, of screens that show the scoreboard. */
  scoreboards?: string[]
  /** How many spectators are watching (see `Game.allowSpectators`). */
  watching?: number
  onApprove: (connId: string) => void
  onReject: (connId: string) => void
  onDisconnect: (connId: string) => void
}

/** A device link with a copy button. */
function LinkRow({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="px-4 py-2 flex items-center gap-2">
      <span className="flex-1 min-w-0 truncate text-xs mono text-muted" title={url}>
        {url}
      </span>
      <Button size="sm" variant="ghost" onClick={handleCopy} aria-label={`Copy ${label} URL`}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

/** Names each device "Screen n" or "Scoreboard n", numbered within its kind. */
function deviceNames(connIds: string[], scoreboards: string[]): string[] {
  const counts = { Screen: 0, Scoreboard: 0 }
  return connIds.map(connId => {
    const kind = scoreboards.includes(connId) ? 'Scoreboard' : 'Screen'
    return `${kind} ${++counts[kind]}`
  })
}

/**
 * The links for projector screens and scoreboard displays on other devices, the devices
 * waiting for approval, the ones currently connected, and how many spectators are watching.
 */
export function ScreensPanel({
  roomId,
  pending,
  connected,
  scoreboards = [],
  watching = 0,
  onApprove,
  onReject,
  onDisconnect,
}: ScreensPanelProps) {
  if (!roomId) return null

  const base = `${window.location.origin}${window.location.pathname}#`
  const pendingNames = deviceNames(pending, scoreboards)
  const connectedNames = deviceNames(connected, scoreboards)

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
      <LinkRow url={`${base}/screen/${roomId}`} label="screen" />
      <LinkRow url={`${base}/scoreboard/${roomId}`} label="scoreboard" />
      {pending.length > 0 && (
        <ul className="flex flex-col">
          {pending.map((connId, i) => (
            <li key={connId} className="px-4 py-2 flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-sm">
                {pendingNames[i]} wants to join
              </span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onApprove(connId)}
                aria-label={`Approve ${pendingNames[i].toLowerCase()}`}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(connId)}
                aria-label={`Reject ${pendingNames[i].toLowerCase()}`}
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
              <span className="flex-1 min-w-0 truncate text-sm">{connectedNames[i]}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDisconnect(connId)}
                aria-label={`Disconnect ${connectedNames[i].toLowerCase()}`}
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
