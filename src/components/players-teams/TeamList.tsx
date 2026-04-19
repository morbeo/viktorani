import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { ManagedTeam } from '@/types/players-teams'
import { Empty, Icon } from '@/components/ui'
import { resolveIcon } from './teamIcons'
import TeamForm from './TeamForm'
import TeamQrModal from './TeamQrModal'
import TeamBulkActionBar from './TeamBulkActionBar'

type LabelFilter = Record<string, 'include' | 'exclude'>

interface Props {
  search?: string
  /** Tri-state label filter -- include/exclude by label ID. */
  labelFilter?: LabelFilter
  /** Called when user clicks a team row -- used by dual-pane to filter players. */
  onSelect?: (teamId: string | null) => void
  selectedTeamId?: string | null
}

function matchesLabelFilter(labelIds: string[], filter: LabelFilter): boolean {
  for (const [id, state] of Object.entries(filter)) {
    if (state === 'include' && !labelIds.includes(id)) return false
    if (state === 'exclude' && labelIds.includes(id)) return false
  }
  return true
}

export default function TeamList({
  search = '',
  labelFilter = {},
  onSelect,
  selectedTeamId,
}: Props) {
  const teams = useLiveQuery(() => db.managedTeams.orderBy('name').toArray(), [])

  const visible = (teams ?? []).filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    if (Object.keys(labelFilter).length > 0 && !matchesLabelFilter(t.labelIds, labelFilter))
      return false
    return true
  })
  const active = visible.filter(t => !t.archivedAt)
  const archived = visible.filter(t => t.archivedAt)

  const [editing, setEditing] = useState<ManagedTeam | null | undefined>(undefined)
  const [qrTarget, setQrTarget] = useState<ManagedTeam | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const activeIds = active.map(t => t.id)
  const allSelected = activeIds.length > 0 && activeIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(activeIds))
  }

  async function archive(t: ManagedTeam) {
    await db.managedTeams.update(t.id, { archivedAt: new Date() })
    if (selectedTeamId === t.id) onSelect?.(null)
  }

  async function restore(t: ManagedTeam) {
    await db.managedTeams.update(t.id, { archivedAt: null })
  }

  if (teams === undefined) return null

  return (
    <>
      <div
        className="rounded-lg overflow-hidden border"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {active.length > 0 && (
          <div
            className="flex items-center gap-3 px-3 py-2 border-b"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all teams"
              className="w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {someSelected ? `${selected.size} selected` : 'Select all'}
            </span>
          </div>
        )}

        {active.length === 0 && archived.length === 0 && (
          <Empty
            message={
              search ? `No teams matching "${search}"` : 'No teams yet — create your first team'
            }
          />
        )}

        {active.map(team => (
          <TeamRow
            key={team.id}
            team={team}
            selected={selectedTeamId === team.id}
            checked={selected.has(team.id)}
            onCheck={() => toggleOne(team.id)}
            onClick={() => onSelect?.(selectedTeamId === team.id ? null : team.id)}
            onEdit={() => setEditing(team)}
            onArchive={() => archive(team)}
            onQr={() => setQrTarget(team)}
          />
        ))}

        {archived.map(team => (
          <TeamRow key={team.id} team={team} archived onRestore={() => restore(team)} />
        ))}
      </div>

      {someSelected && (
        <TeamBulkActionBar selectedIds={selected} onDone={() => setSelected(new Set())} />
      )}

      <TeamForm
        open={editing !== undefined}
        team={editing ?? null}
        onClose={() => setEditing(undefined)}
      />
      <TeamQrModal open={qrTarget !== null} team={qrTarget} onClose={() => setQrTarget(null)} />
    </>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  team: ManagedTeam
  selected?: boolean
  checked?: boolean
  onCheck?: () => void
  archived?: boolean
  onClick?: () => void
  onEdit?: () => void
  onArchive?: () => void
  onQr?: () => void
  onRestore?: () => void
}

function TeamRow({
  team,
  selected,
  checked,
  onCheck,
  archived,
  onClick,
  onEdit,
  onArchive,
  onQr,
  onRestore,
}: RowProps) {
  const TeamIcon = resolveIcon(team.icon)

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 transition-colors"
      style={{
        borderColor: 'var(--color-border)',
        opacity: archived ? 0.45 : 1,
        background: selected ? `${team.color}12` : 'transparent',
        cursor: archived ? 'default' : 'pointer',
      }}
      onClick={archived ? undefined : onClick}
      role={archived ? undefined : 'button'}
      aria-pressed={selected}
      aria-label={archived ? undefined : `${selected ? 'Deselect' : 'Select'} team ${team.name}`}
    >
      {/* Checkbox — active rows only */}
      {!archived && (
        <input
          type="checkbox"
          checked={checked ?? false}
          onChange={onCheck}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${team.name}`}
          className="w-3.5 h-3.5 cursor-pointer shrink-0"
        />
      )}

      {/* Badge */}
      <span
        className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-white"
        style={{ background: team.color }}
        aria-hidden
      >
        <Icon icon={TeamIcon} size="sm" />
      </span>

      {/* Name */}
      <span className="flex-1 text-sm min-w-0 truncate" style={{ color: 'var(--color-ink)' }}>
        {team.name}
      </span>

      {/* Player count */}
      <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--color-muted)' }}>
        {team.playerIds.length}p
      </span>

      {/* Actions */}
      {archived ? (
        <>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-border)', color: 'var(--color-muted)' }}
          >
            Archived
          </span>
          <button
            onClick={e => {
              e.stopPropagation()
              onRestore?.()
            }}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--color-gold)' }}
            aria-label={`Restore ${team.name}`}
          >
            Restore
          </button>
        </>
      ) : (
        <>
          {selected && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: team.color }}
              aria-hidden
            />
          )}
          <button
            onClick={e => {
              e.stopPropagation()
              onQr?.()
            }}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--color-muted)' }}
            aria-label={`Show QR for ${team.name}`}
          >
            QR
          </button>
          <button
            onClick={e => {
              e.stopPropagation()
              onEdit?.()
            }}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--color-muted)' }}
            aria-label={`Edit ${team.name}`}
          >
            Edit
          </button>
          <button
            onClick={e => {
              e.stopPropagation()
              onArchive?.()
            }}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--color-red)' }}
            aria-label={`Archive ${team.name}`}
          >
            Archive
          </button>
        </>
      )}
    </div>
  )
}
