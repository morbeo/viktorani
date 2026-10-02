import { Button } from '@/components/ui'
import type { TransportStatus } from '@/transport'

export interface TransportBannerProps {
  status: TransportStatus
  /** What went wrong, from `transportManager.error`. */
  error: string | null
  /** The retry the host is waiting on (from 1) while opening the room is retried. */
  retrying: number | null
  onRetry: () => void
}

/**
 * Tells the host when the room is not reachable: while it is being retried, and with a
 * Retry button once the retries are used up. Renders nothing while connected.
 */
export function TransportBanner({ status, error, retrying, onRetry }: TransportBannerProps) {
  const failed = status === 'error' && retrying === null
  if (!failed && status !== 'disconnected' && retrying === null) return null

  return (
    <div
      role={failed ? 'alert' : 'status'}
      className="mb-4 px-4 py-3 rounded-lg border text-sm flex items-center justify-between gap-4"
      style={{
        borderColor: failed ? 'var(--color-red)' : 'var(--color-gold)',
        color: failed ? 'var(--color-red)' : 'var(--color-ink)',
      }}
    >
      <span>
        {failed
          ? `Players cannot reach this game. ${error ?? 'The connection failed.'}`
          : retrying !== null
            ? `Opening the room… (retry ${retrying})`
            : 'Lost the connection server; reconnecting… Players already connected can keep playing.'}
      </span>
      {failed && (
        <Button variant="primary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
