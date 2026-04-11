import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { ManagedPlayer, ManagedTeam } from '@/types/players-teams'
import { Empty } from '@/components/ui'
import PlayerForm from './PlayerForm'
import BulkActionBar from './BulkActionBar'
import PlayerQrModal from './PlayerQrModal'

type LabelFilter = Record<string, 'include' | 'exclude'>

interface Props {
  filterTeamId?: string
  search?: string
  labelFilter?: LabelFilter
}

function matchesSearch(name: string, search: string): boolean {
  return name.toLowerCase().includes(search.toLowerCase())
}

function matchesLabelFilter(labelIds: string[], filter: LabelFilter): boolean {
  for (const [id, state] of Object.entries(filter)) {
    if (state === 'include' && !labelIds.includes(id)) return false
    if (state === 'exclude' && labelIds.includes(id)) return false
  }
  return true
}

export default function PlayerList({ filterTeamId, search = '', labelFilter = {} }: Props) {
  const players = useLiveQuery(() => db.managedPlayers.orderBy('name').toArray(), [])
  const teams = useLiveQuery(() => db.managedTeams.toArray(), [])
  const labels = useLiveQuery(() => db.managedLabels.toArray(), [])

  const [editing, setEditing] = useState<ManagedPlayer | null | undefined>(undefined)
  const [qrTarget, setQrTarget] = useState<ManagedPlayer | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const teamMap = Object.fromEntries((teams ?? []).map(t => [t.id, t]))
  const labelMap = Object.fromEntries((labels ?? []).map(l => [l.id, l]))

  const visible = (players ?? []).filter(p => {
    if (filterTeamId && !p.teamIds.includes(filterTeamId)) return false
    if (search && !matchesSearch(p.name, search)) return false
    if (Object.keys(labelFilter).length > 0 && !matchesLabelFilter(p.labelIds, labelFilter))
      return false
    return true
  })

  const active = visible.filter(p => !p.archivedAt)
  const archived = visible.filter(p => p.archivedAt)
  const activeIds = active.map(p => p.id)
  const allSelected = activeIds.length > 0 && activeIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(activeIds))
  }

  async function archive(p: ManagedPlayer) {
    await db.managedPlayers.update(p.id, { archivedAt: new Date() })
  }

  async function restore(p: ManagedPlayer) {
    await db.managedPlayers.update(p.id, { archivedAt: null })
  }

  function emptyMessage(): string {
    if (filterTeamId && search) return `No players in this team matching "${search}"`
    if (filterTeamId) return 'No players in this team yet'
    if (search) return `No players matching "${search}"`
    return 'No players yet — add your first player or scan a QR'
  }

  if (players === undefined) return null

  return (
    <div className="flex flex-col">
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
              aria-label="Select all players"
              className="w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {someSelected ? `${selected.size} selected` : 'Select all'}
            </span>
          </div>
        )}

        {active.length === 0 && archived.length === 0 && <Empty message={emptyMessage()} />}

        {active.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            teamMap={teamMap}
            labelMap={labelMap}
            checked={selected.has(player.id)}
            onCheck={() => toggleOne(player.id)}
            onEdit={() => setEditing(player)}
            onArchive={() => archive(player)}
            onQr={() => setQrTarget(player)}
          />
        ))}

        {archived.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            teamMap={teamMap}
            labelMap={labelMap}
            archived
            onRestore={() => restore(player)}
          />
        ))}
      </div>

      {someSelected && (
        <BulkActionBar selectedIds={selected} onDone={() => setSelected(new Set())} />
      )}

      <PlayerForm
        open={editing !== undefined}
        player={editing ?? null}
        onClose={() => setEditing(undefined)}
      />
      <PlayerQrModal open={qrTarget !== null} player={qrTarget} onClose={() => setQrTarget(null)} />
    </div>
  )
}

interface RowProps {
  player: ManagedPlayer
  teamMap: Record<string, ManagedTeam>
  labelMap: Record<string, { name: string; color: string }>
  archived?: boolean
  checked?: boolean
  onCheck?: () => void
  onEdit?: () => void
  onArchive?: () => void
  onQr?: () => void
  onRestore?: () => void
}

function PlayerRow({
  player,
  teamMap,
  labelMap,
  archived,
  checked,
  onCheck,
  onEdit,
  onArchive,
  onQr,
  onRestore,
}: RowProps) {
  const playerTeams = player.teamIds.map(id => teamMap[id]).filter(Boolean)
  const playerLabels = player.labelIds.map(id => labelMap[id]).filter(Boolean)

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0"
      style={{ borderColor: 'var(--color-border)', opacity: archived ? 0.45 : 1 }}
    >
      {!archived && (
        <input
          type="checkbox"
          checked={checked ?? false}
          onChange={onCheck}
          aria-label={`Select ${player.name}`}
          className="w-3.5 h-3.5 cursor-pointer shrink-0"
        />
      )}

      <div className="flex gap-1 shrink-0">
        {playerTeams.length > 0 ? (
          playerTeams.map(team => (
            <span
              key={team.id}
              className="w-5 h-5 rounded flex items-center justify-center text-xs"
              style={{ background: team.color, color: '#fff' }}
              title={team.name}
              aria-label={team.name}
            >
              {team.icon}
            </span>
          ))
        ) : (
          <span
            className="w-5 h-5 rounded flex items-center justify-center text-xs"
            style={{ background: 'var(--color-border)', color: 'var(--color-muted)' }}
            aria-label="No team"
          >
            —
          </span>
        )}
      </div>

      <span className="flex-1 text-sm min-w-0 truncate" style={{ color: 'var(--color-ink)' }}>
        {player.name}
      </span>

      <div className="flex gap-1 flex-wrap overflow-hidden max-w-[140px]">
        {playerLabels.map(label => (
          <span
            key={label.name}
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              background: label.color + '22',
              color: label.color,
              border: `1px solid ${label.color}44`,
            }}
          >
            {label.name}
          </span>
        ))}
      </div>

      <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--color-muted)' }}>
        {player.totalScore} pts
      </span>

      {archived ? (
        <>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-border)', color: 'var(--color-muted)' }}
          >
            Archived
          </span>
          <button
            onClick={onRestore}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--color-gold)' }}
            aria-label={`Restore ${player.name}`}
          >
            Restore
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onQr}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--color-muted)' }}
            aria-label={`Show QR for ${player.name}`}
          >
            QR
          </button>
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--color-muted)' }}
            aria-label={`Edit ${player.name}`}
          >
            Edit
          </button>
          <button
            onClick={onArchive}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
            style={{ color: 'var(--color-red)' }}
            aria-label={`Archive ${player.name}`}
          >
            Archive
          </button>
        </>
      )}
    </div>
  )
}
