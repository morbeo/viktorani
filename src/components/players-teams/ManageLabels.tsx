import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { ManagedLabel } from '@/types/players-teams'
import { Button, Input } from '@/components/ui'

interface EditState {
  id: string | null // null = new
  name: string
  color: string
}

const DEFAULT_COLOR = '#6366f1'

function empty(): EditState {
  return { id: null, name: '', color: DEFAULT_COLOR }
}

export default function ManageLabels() {
  const labels = useLiveQuery(() => db.managedLabels.orderBy('name').toArray(), [])
  const [editing, setEditing] = useState<EditState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function startEditing(state: EditState | null) {
    setEditing(state)
    setError(null)
  }

  async function save() {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) {
      setError('Name is required')
      return
    }

    setBusy(true)
    try {
      if (editing.id) {
        await db.managedLabels.update(editing.id, { name, color: editing.color })
      } else {
        await db.managedLabels.add({ id: crypto.randomUUID(), name, color: editing.color })
      }
      startEditing(null)
    } catch {
      setError('Failed to save — name may already be in use')
    } finally {
      setBusy(false)
    }
  }

  async function remove(label: ManagedLabel) {
    const [playerCount, teamCount] = await Promise.all([
      db.managedPlayers.filter(p => p.labelIds.includes(label.id)).count(),
      db.managedTeams.filter(t => t.labelIds.includes(label.id)).count(),
    ])
    const total = playerCount + teamCount
    if (total > 0) {
      const parts: string[] = []
      if (playerCount > 0) parts.push(`${playerCount} player${playerCount === 1 ? '' : 's'}`)
      if (teamCount > 0) parts.push(`${teamCount} team${teamCount === 1 ? '' : 's'}`)
      setError(`"${label.name}" is used by ${parts.join(' and ')} — detach it first`)
      return
    }
    await db.managedLabels.delete(label.id)
    if (editing?.id === label.id) startEditing(null)
  }

  const isEditing = (id: string) => editing?.id === id

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-base text-text">Labels</h2>
          <p className="text-xs mt-0.5 text-muted">
            Attach labels to players and teams for filtering
          </p>
        </div>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={() => startEditing(empty())}>
            + Add
          </Button>
        )}
      </div>

      {error && (
        <p
          className="text-xs mb-3 px-3 py-2 rounded text-negative"
          style={{ background: 'var(--color-negative)1a' }}
        >
          {error}
        </p>
      )}

      <div className="rounded-lg overflow-hidden border border-border">
        {/* Add row */}
        {editing?.id === null && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface">
            <input
              type="color"
              value={editing.color}
              onChange={e => setEditing(s => s && { ...s, color: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border border-border"
              style={{ padding: '1px' }}
              aria-label="Label colour"
            />
            <Input
              value={editing.name}
              onChange={e => setEditing(s => s && { ...s, name: e.target.value })}
              placeholder="Label name"
              className="flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') startEditing(null)
              }}
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={save} disabled={busy}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => startEditing(null)}>
              Cancel
            </Button>
          </div>
        )}

        {labels?.length === 0 && !editing && (
          <p className="px-4 py-6 text-sm text-center text-muted">No labels yet — add one above</p>
        )}

        {labels?.map(label => (
          <div key={label.id} className="border-b last:border-b-0 border-border">
            {isEditing(label.id) ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-surface">
                <input
                  type="color"
                  value={editing!.color}
                  onChange={e => setEditing(s => s && { ...s, color: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border border-border"
                  style={{ padding: '1px' }}
                  aria-label="Label colour"
                />
                <Input
                  value={editing!.name}
                  onChange={e => setEditing(s => s && { ...s, name: e.target.value })}
                  className="flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter') save()
                    if (e.key === 'Escape') startEditing(null)
                  }}
                  autoFocus
                />
                <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEditing(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: label.color }}
                  aria-hidden
                />
                <span className="flex-1 text-sm text-text">{label.name}</span>
                <button
                  onClick={() =>
                    startEditing({ id: label.id, name: label.name, color: label.color })
                  }
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5 text-muted"
                  aria-label={`Edit ${label.name}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(label)}
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5 text-negative"
                  aria-label={`Delete ${label.name}`}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
