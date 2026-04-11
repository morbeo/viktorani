import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { ManagedPlayer } from '@/types/players-teams'
import { Modal, Button, Input } from '@/components/ui'

interface Props {
  /** Existing player to edit, or null to create a new one. */
  player: ManagedPlayer | null
  /** Pre-selected team ID when creating from within a team context. */
  defaultTeamId?: string
  open: boolean
  onClose: () => void
}

interface FormState {
  name: string
  labelIds: string[]
}

function emptyForm(): FormState {
  return { name: '', labelIds: [] }
}

function playerToForm(p: ManagedPlayer): FormState {
  return { name: p.name, labelIds: p.labelIds }
}

export default function PlayerForm({ player, defaultTeamId, open, onClose }: Props) {
  const isNew = player === null
  const labels = useLiveQuery(() => db.managedLabels.orderBy('name').toArray(), [])
  const teams = useLiveQuery(() => db.managedTeams.orderBy('name').toArray(), [])

  const [form, setForm] = useState<FormState>(emptyForm)
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Reset form whenever the modal opens
  useEffect(() => {
    if (!open) return
    if (player) {
      setForm(playerToForm(player))
      setTeamIds(player.teamIds)
    } else {
      setForm(emptyForm())
      setTeamIds(defaultTeamId ? [defaultTeamId] : [])
    }
    setError(null)
  }, [open, player, defaultTeamId])

  function toggleLabel(id: string) {
    setForm(f => ({
      ...f,
      labelIds: f.labelIds.includes(id) ? f.labelIds.filter(l => l !== id) : [...f.labelIds, id],
    }))
  }

  function toggleTeam(id: string) {
    setTeamIds(prev => (prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]))
  }

  async function save() {
    const name = form.name.trim()
    if (!name) {
      setError('Name is required')
      return
    }

    setBusy(true)
    try {
      if (player) {
        // Edit: update player fields; team sync handled by the dual-pane view
        await db.managedPlayers.update(player.id, {
          name,
          labelIds: form.labelIds,
          teamIds,
        })
        // Sync team.playerIds for any teams whose membership changed
        await syncTeamMembership(player.id, player.teamIds, teamIds)
      } else {
        const id = crypto.randomUUID()
        await db.managedPlayers.add({
          id,
          name,
          teamIds,
          labelIds: form.labelIds,
          archivedAt: null,
          totalScore: 0,
          gameLog: [],
        })
        await syncTeamMembership(id, [], teamIds)
      }
      onClose()
    } catch {
      setError('Failed to save — please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'New player' : 'Edit player'}
      maxWidth="440px"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p
            className="text-xs px-3 py-2 rounded"
            style={{ color: 'var(--color-red)', background: 'var(--color-red)1a' }}
          >
            {error}
          </p>
        )}

        <Input
          label="Name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Player name"
          onKeyDown={e => {
            if (e.key === 'Enter') save()
          }}
          autoFocus
        />

        {/* Team assignment */}
        {teams && teams.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Teams
            </span>
            <div className="flex flex-wrap gap-2">
              {teams.map(team => {
                const selected = teamIds.includes(team.id)
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all"
                    style={{
                      borderColor: selected ? team.color : 'var(--color-border)',
                      background: selected ? team.color + '22' : 'transparent',
                      color: selected ? team.color : 'var(--color-muted)',
                    }}
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Remove from' : 'Add to'} ${team.name}`}
                  >
                    <span>{team.icon}</span>
                    {team.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Label assignment */}
        {labels && labels.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Labels
            </span>
            <div className="flex flex-wrap gap-2">
              {labels.map(label => {
                const selected = form.labelIds.includes(label.id)
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all"
                    style={{
                      borderColor: selected ? label.color : 'var(--color-border)',
                      background: selected ? label.color + '22' : 'transparent',
                      color: selected ? label.color : 'var(--color-muted)',
                    }}
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Remove' : 'Add'} label ${label.name}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: label.color }}
                      aria-hidden
                    />
                    {label.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving...' : isNew ? 'Create player' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sync team.playerIds for any teams whose membership changed.
 * Runs all updates in a single transaction.
 */
async function syncTeamMembership(
  playerId: string,
  prevTeamIds: string[],
  nextTeamIds: string[]
): Promise<void> {
  const added = nextTeamIds.filter(id => !prevTeamIds.includes(id))
  const removed = prevTeamIds.filter(id => !nextTeamIds.includes(id))
  if (added.length === 0 && removed.length === 0) return

  await db.transaction('rw', [db.managedTeams], async () => {
    const affectedIds = [...new Set([...added, ...removed])]
    const teams = await db.managedTeams.bulkGet(affectedIds)
    await Promise.all(
      teams.map(team => {
        if (!team) return
        const isAdded = added.includes(team.id)
        const newPlayerIds = isAdded
          ? team.playerIds.includes(playerId)
            ? team.playerIds
            : [...team.playerIds, playerId]
          : team.playerIds.filter(id => id !== playerId)
        return db.managedTeams.update(team.id, { playerIds: newPlayerIds })
      })
    )
  })
}
