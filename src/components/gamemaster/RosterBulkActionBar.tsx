import { useState } from 'react'
import { Button, Modal, Input, Icon } from '@/components/ui'
import { resolveIcon } from '@/components/players-teams/teamIcons'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { Team } from '@/db'

interface RosterBulkActionBarProps {
  selectedIds: Set<string>
  teams: Team[]
  onAssignPlayer: (playerId: string, teamId: string | null) => Promise<void>
  onAdjustScore: (playerId: string, delta: number) => Promise<void>
  onKick: (playerId: string) => void
  onDone: () => void
}

type Action = 'assign-team' | 'adjust-score' | 'kick' | null

/** Bulk actions for the roster's selected players: assign team, adjust score, kick. */
export function RosterBulkActionBar({
  selectedIds,
  teams,
  onAssignPlayer,
  onAdjustScore,
  onKick,
  onDone,
}: RosterBulkActionBarProps) {
  const [{ confirmDestructive }] = useAppSettings()
  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)
  const [delta, setDelta] = useState(1)

  const count = selectedIds.size

  async function handleAssignTeam(teamId: string | null) {
    setBusy(true)
    try {
      await Promise.all([...selectedIds].map(id => onAssignPlayer(id, teamId)))
    } finally {
      setBusy(false)
      setAction(null)
      onDone()
    }
  }

  async function handleAdjustScore(sign: 1 | -1) {
    setBusy(true)
    try {
      await Promise.all([...selectedIds].map(id => onAdjustScore(id, sign * delta)))
    } finally {
      setBusy(false)
      setAction(null)
      onDone()
    }
  }

  function handleKickConfirm() {
    for (const id of selectedIds) onKick(id)
    setAction(null)
    onDone()
  }

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2 mt-2 rounded-lg border"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        role="toolbar"
        aria-label="Bulk actions"
      >
        <span className="text-xs font-medium mr-1" style={{ color: 'var(--color-ink)' }}>
          {count} selected
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setAction('assign-team')}
          className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink)' }}
          aria-label="Assign team to selected players"
        >
          Assign team
        </button>
        <button
          onClick={() => setAction('adjust-score')}
          className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink)' }}
          aria-label="Adjust score for selected players"
        >
          Adjust score
        </button>
        <button
          onClick={() => (confirmDestructive ? setAction('kick') : handleKickConfirm())}
          className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--color-red)', color: 'var(--color-red)' }}
          aria-label="Kick selected players"
        >
          Kick
        </button>
        <button
          onClick={onDone}
          className="text-xs px-2 py-1.5 rounded transition-colors hover:bg-black/5"
          style={{ color: 'var(--color-muted)' }}
          aria-label="Clear selection"
        >
          ✕
        </button>
      </div>

      <Modal
        open={action === 'assign-team'}
        onClose={() => setAction(null)}
        title="Assign team"
        maxWidth="320px"
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
            Move {count} player{count !== 1 ? 's' : ''} to a team:
          </p>
          <button
            onClick={() => void handleAssignTeam(null)}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 rounded border text-sm text-left transition-colors hover:bg-black/5 disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)' }}
          >
            No team
          </button>
          {teams.map(team => (
            <button
              key={team.id}
              onClick={() => void handleAssignTeam(team.id)}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 rounded border text-sm text-left transition-colors hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <Icon icon={resolveIcon(team.icon)} />
              {team.name}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={action === 'adjust-score'}
        onClose={() => setAction(null)}
        title="Adjust score"
        maxWidth="280px"
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Apply the same change to {count} player{count !== 1 ? 's' : ''}:
          </p>
          <Input
            label="Points"
            type="number"
            value={delta}
            onChange={e => setDelta(Number(e.target.value) || 0)}
            min={0}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => void handleAdjustScore(-1)} disabled={busy}>
              − {delta}
            </Button>
            <Button variant="primary" onClick={() => void handleAdjustScore(1)} disabled={busy}>
              + {delta}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={action === 'kick'}
        onClose={() => setAction(null)}
        title="Kick players?"
        maxWidth="320px"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
            Kicking {count} player{count !== 1 ? 's' : ''}. They can rejoin if the game allows it.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleKickConfirm}>
              Kick
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
