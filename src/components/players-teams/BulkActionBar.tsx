import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { Button, Modal } from '@/components/ui'
import { addPlayerToTeam } from '@/db/players-teams'

interface Props {
  selectedIds: Set<string>
  onDone: () => void
}

type Action = 'assign-team' | 'add-label' | 'remove-label' | 'archive' | 'archive-confirm' | null

export default function BulkActionBar({ selectedIds, onDone }: Props) {
  const teams = useLiveQuery(() => db.managedTeams.filter(t => !t.archivedAt).toArray(), [])
  const labels = useLiveQuery(() => db.managedLabels.orderBy('name').toArray(), [])

  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)

  const count = selectedIds.size

  async function handleAssignTeam(teamId: string) {
    setBusy(true)
    try {
      await Promise.all([...selectedIds].map(pid => addPlayerToTeam(pid, teamId)))
    } finally {
      setBusy(false)
      setAction(null)
      onDone()
    }
  }

  async function handleAddLabel(labelId: string) {
    setBusy(true)
    try {
      const players = await db.managedPlayers.bulkGet([...selectedIds])
      await Promise.all(
        players.map(p => {
          if (!p || p.labelIds.includes(labelId)) return
          return db.managedPlayers.update(p.id, {
            labelIds: [...p.labelIds, labelId],
          })
        })
      )
    } finally {
      setBusy(false)
      setAction(null)
      onDone()
    }
  }

  async function handleRemoveLabel(labelId: string) {
    setBusy(true)
    try {
      const players = await db.managedPlayers.bulkGet([...selectedIds])
      await Promise.all(
        players.map(p => {
          if (!p || !p.labelIds.includes(labelId)) return
          return db.managedPlayers.update(p.id, {
            labelIds: p.labelIds.filter(id => id !== labelId),
          })
        })
      )
    } finally {
      setBusy(false)
      setAction(null)
      onDone()
    }
  }

  async function handleArchiveConfirm() {
    setBusy(true)
    try {
      await Promise.all(
        [...selectedIds].map(id => db.managedPlayers.update(id, { archivedAt: new Date() }))
      )
    } finally {
      setBusy(false)
      setAction(null)
      onDone()
    }
  }

  return (
    <>
      {/* Sticky bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 mt-2 rounded-lg border"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface)',
        }}
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
          onClick={() => setAction('add-label')}
          className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink)' }}
          aria-label="Add label to selected players"
        >
          Add label
        </button>
        <button
          onClick={() => setAction('remove-label')}
          className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink)' }}
          aria-label="Remove label from selected players"
        >
          Remove label
        </button>
        <button
          onClick={() => setAction('archive')}
          className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--color-red)', color: 'var(--color-red)' }}
          aria-label="Archive selected players"
        >
          Archive
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

      {/* Assign team picker */}
      <Modal
        open={action === 'assign-team'}
        onClose={() => setAction(null)}
        title="Assign team"
        maxWidth="320px"
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
            Add {count} player{count !== 1 ? 's' : ''} to a team:
          </p>
          {(teams ?? []).map(team => (
            <button
              key={team.id}
              onClick={() => handleAssignTeam(team.id)}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 rounded border text-sm text-left transition-colors hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="w-4 h-4 rounded shrink-0"
                style={{ background: team.color }}
                aria-hidden
              />
              {team.name}
            </button>
          ))}
          {(teams ?? []).length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--color-muted)' }}>
              No teams yet
            </p>
          )}
        </div>
      </Modal>

      {/* Add label picker */}
      <Modal
        open={action === 'add-label'}
        onClose={() => setAction(null)}
        title="Add label"
        maxWidth="320px"
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
            Add label to {count} player{count !== 1 ? 's' : ''}:
          </p>
          {(labels ?? []).map(label => (
            <button
              key={label.id}
              onClick={() => handleAddLabel(label.id)}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 rounded border text-sm text-left transition-colors hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: label.color }}
                aria-hidden
              />
              {label.name}
            </button>
          ))}
          {(labels ?? []).length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--color-muted)' }}>
              No labels yet
            </p>
          )}
        </div>
      </Modal>

      {/* Remove label picker */}
      <Modal
        open={action === 'remove-label'}
        onClose={() => setAction(null)}
        title="Remove label"
        maxWidth="320px"
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
            Remove label from {count} player{count !== 1 ? 's' : ''}:
          </p>
          {(labels ?? []).map(label => (
            <button
              key={label.id}
              onClick={() => handleRemoveLabel(label.id)}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 rounded border text-sm text-left transition-colors hover:bg-black/5 disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: label.color }}
                aria-hidden
              />
              {label.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Archive step 1 — confirm */}
      <Modal
        open={action === 'archive'}
        onClose={() => setAction(null)}
        title="Archive players?"
        maxWidth="320px"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
            Archiving {count} player{count !== 1 ? 's' : ''}. Records will appear greyed-out
            in-place. No undo.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleArchiveConfirm} disabled={busy}>
              {busy ? 'Archiving...' : 'Archive'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
