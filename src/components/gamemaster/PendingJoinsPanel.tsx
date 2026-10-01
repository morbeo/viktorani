import { Button } from '@/components/ui'
import type { PendingJoin } from '@/pages/admin/player-connections'

interface PendingJoinsPanelProps {
  pending: PendingJoin[]
  onApprove: (connId: string) => void
  onReject: (connId: string) => void
}

/** Join requests waiting for the host when the game requires approval. Hidden when empty. */
export function PendingJoinsPanel({ pending, onApprove, onReject }: PendingJoinsPanelProps) {
  if (pending.length === 0) return null

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ borderColor: 'var(--color-gold)', background: 'var(--color-surface)' }}
    >
      <div
        className="px-4 py-3 border-b text-xs font-semibold uppercase tracking-wider"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
      >
        Waiting for approval ({pending.length})
      </div>
      <ul className="flex flex-col">
        {pending.map(({ connId, join }) => (
          <li key={connId} className="px-4 py-2 flex items-center gap-2">
            <span className="flex-1 min-w-0 truncate text-sm">
              {join.playerName}
              {join.newTeamName && (
                <span className="ml-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                  new team: {join.newTeamName}
                </span>
              )}
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onApprove(connId)}
              aria-label={`Approve ${join.playerName}`}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReject(connId)}
              aria-label={`Reject ${join.playerName}`}
            >
              Reject
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
