import { useState } from 'react'
import {
  CircleDot,
  EyeOff,
  LogOut,
  Plus,
  StickyNote,
  UserX,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { Icon, Button, Input } from '@/components/ui'
import { canAssignToTeam, isConnected } from '@/pages/admin/gamemaster-utils'
import { RosterBulkActionBar } from './RosterBulkActionBar'
import type { Game, Player, PlayerPresence, Team } from '@/db'

interface RosterPanelProps {
  game: Game
  players: Player[]
  teams: Team[]
  onKick: (playerId: string) => void
  onAddPlayer: (name: string, teamId: string | null) => Promise<void>
  onAssignPlayer: (playerId: string, teamId: string | null) => Promise<void>
  onAdjustScore: (playerId: string, delta: number) => Promise<void>
  onUpdatePlayerNotes: (playerId: string, notes: string) => Promise<void>
  /**
   * Controls the selection from outside (e.g. clicking a team row elsewhere selects its
   * members). Omit both to let the panel manage its own selection.
   */
  selected?: Set<string>
  onSelectedChange?: (next: Set<string>) => void
}

/** How each presence is shown: icon, colour, short label and what it means. */
const PRESENCE: Record<
  PlayerPresence,
  { icon: LucideIcon; color: string; label: string; meaning: string }
> = {
  connected: {
    icon: CircleDot,
    color: 'var(--color-green)',
    label: 'Connected',
    meaning: 'Playing.',
  },
  hidden: {
    icon: EyeOff,
    color: 'var(--color-gold)',
    label: 'Tab hidden',
    meaning: 'Connected, but looking at something else.',
  },
  disconnected: {
    icon: WifiOff,
    color: 'var(--color-muted)',
    label: 'Disconnected',
    meaning: 'Not connected. They can rejoin from their device if rejoining is allowed.',
  },
  left: {
    icon: LogOut,
    color: 'var(--color-muted)',
    label: 'Left',
    meaning: 'They left the game.',
  },
  kicked: { icon: UserX, color: 'var(--color-red)', label: 'Kicked', meaning: 'You removed them.' },
}

/**
 * Live roster panel for the GameMaster.
 * Shows each player's name, team (assignable here), score, and presence (see {@link PRESENCE}).
 * Players can be added directly, multi-selected for bulk team assignment, score adjustment
 * and kicking (see {@link RosterBulkActionBar}), or kicked one at a time.
 *
 * The header counts connected players, with tab-hidden and disconnected ones listed apart.
 */
export function RosterPanel({
  game,
  players,
  teams,
  onKick,
  onAddPlayer,
  onAssignPlayer,
  onAdjustScore,
  onUpdatePlayerNotes,
  selected: controlledSelected,
  onSelectedChange,
}: RosterPanelProps) {
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set())
  const selected = controlledSelected ?? internalSelected
  const setSelected = onSelectedChange ?? setInternalSelected
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTeamId, setNewTeamId] = useState('')
  const [busy, setBusy] = useState(false)

  const teamMap = new Map(teams.map(t => [t.id, t]))
  const count = (presence: PlayerPresence) => players.filter(p => p.presence === presence).length
  const onlineCount = count('connected')
  const hiddenCount = count('hidden')
  const disconnectedCount = count('disconnected')
  const summary = [
    `${onlineCount} connected`,
    hiddenCount > 0 && `${hiddenCount} tab hidden`,
    disconnectedCount > 0 && `${disconnectedCount} disconnected`,
  ]
    .filter(Boolean)
    .join(' · ')

  const allIds = players.map(p => p.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await onAddPlayer(trimmed, newTeamId || null)
      setNewName('')
      setNewTeamId('')
      setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Players
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: onlineCount > 0 ? 'var(--color-green)22' : 'var(--color-border)',
              color: onlineCount > 0 ? 'var(--color-green)' : 'var(--color-muted)',
            }}
            aria-live="polite"
          >
            {summary}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setAdding(a => !a)}>
            <Icon icon={Plus} size="sm" />
            Add player
          </Button>
        </div>
      </div>

      {/* Add player form */}
      {adding && (
        <div
          className="px-4 py-3 border-b flex items-end gap-2"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex-1">
            <Input
              label="Name"
              placeholder="Player name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleAdd()
              }}
              maxLength={40}
              autoFocus
              aria-label="New player name"
            />
          </div>
          {teams.length > 0 && (
            <select
              value={newTeamId}
              onChange={e => setNewTeamId(e.target.value)}
              className="text-xs rounded border px-2 py-2"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-cream)',
                color: 'var(--color-ink)',
              }}
              aria-label="New player's team"
            >
              <option value="">No team</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleAdd()}
            disabled={busy || !newName.trim()}
          >
            Add
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Select all */}
      {players.length > 0 && (
        <div
          className="px-4 py-1.5 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Select all players"
            className="w-3.5 h-3.5 cursor-pointer"
          />
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>
        </div>
      )}

      {/* Player rows */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 320 }}>
        {players.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              No players yet
            </p>
          </div>
        ) : (
          players.map(player => (
            <PlayerRow
              key={player.id}
              game={game}
              player={player}
              players={players}
              team={player.teamId ? teamMap.get(player.teamId) : undefined}
              teams={teams}
              checked={selected.has(player.id)}
              onToggle={() => toggleOne(player.id)}
              onAssignPlayer={onAssignPlayer}
              onKick={onKick}
              onUpdateNotes={onUpdatePlayerNotes}
            />
          ))
        )}
      </div>

      {selected.size > 0 && (
        <div className="px-4 pb-3">
          <RosterBulkActionBar
            selectedIds={selected}
            teams={teams}
            onAssignPlayer={onAssignPlayer}
            onAdjustScore={onAdjustScore}
            onKick={onKick}
            onDone={() => setSelected(new Set())}
          />
        </div>
      )}
    </div>
  )
}

interface PlayerRowProps {
  game: Game
  player: Player
  players: Player[]
  team: Team | undefined
  teams: Team[]
  checked: boolean
  onToggle: () => void
  onAssignPlayer: (playerId: string, teamId: string | null) => Promise<void>
  onKick: (playerId: string) => void
  onUpdateNotes: (playerId: string, notes: string) => Promise<void>
}

/** One player row: select, presence, name, team, score, notes and kick. */
function PlayerRow({
  game,
  player,
  players,
  team,
  teams,
  checked,
  onToggle,
  onAssignPlayer,
  onKick,
  onUpdateNotes,
}: PlayerRowProps) {
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState(player.notes)
  const presence = PRESENCE[player.presence]

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${player.name}`}
          className="w-3.5 h-3.5 cursor-pointer shrink-0"
        />

        {/* Presence */}
        <span
          role="img"
          style={{ color: presence.color }}
          aria-label={presence.label}
          title={`${presence.label}: ${presence.meaning}`}
          className="shrink-0"
        >
          <Icon icon={presence.icon} size="sm" aria-hidden />
        </span>

        {/* Name */}
        <span
          className="flex-1 text-sm truncate"
          style={{ color: isConnected(player) ? 'var(--color-ink)' : 'var(--color-muted)' }}
        >
          {player.name}
        </span>

        {/* Team assignment */}
        <select
          value={player.teamId ?? ''}
          onChange={e => void onAssignPlayer(player.id, e.target.value || null)}
          className="text-xs rounded border px-1.5 py-1 shrink-0"
          style={{
            borderColor: 'var(--color-border)',
            background: team ? team.color : 'var(--color-cream)',
            color: team ? '#fff' : 'var(--color-ink)',
            maxWidth: 108,
          }}
          aria-label={`Assign ${player.name} to team`}
        >
          <option value="">No team</option>
          {teams.map(t => {
            const blocked = player.teamId !== t.id && !canAssignToTeam(game, t, players, player.id)
            return (
              <option key={t.id} value={t.id} disabled={blocked}>
                {t.name}
                {blocked ? ' (full)' : ''}
              </option>
            )
          })}
        </select>

        {/* Score */}
        <span
          className="mono text-sm font-bold w-8 text-right shrink-0"
          style={{ color: 'var(--color-ink)' }}
        >
          {player.score}
        </span>

        {/* Notes */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNotes(s => !s)}
          aria-label={`${player.name} notes`}
          title="Notes"
          style={{ padding: '0.25rem', color: player.notes ? 'var(--color-gold)' : undefined }}
        >
          <Icon icon={StickyNote} size="sm" aria-hidden />
        </Button>

        {/* Kick button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onKick(player.id)}
          aria-label={`Kick ${player.name}`}
          title={`Kick ${player.name}`}
          style={{ color: 'var(--color-red)', padding: '0.25rem' }}
        >
          <Icon icon={UserX} size="sm" aria-hidden />
        </Button>
      </div>

      {showNotes && (
        <div className="px-4 pb-3">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== player.notes) void onUpdateNotes(player.id, notes)
            }}
            placeholder="Notes for this player…"
            maxLength={2000}
            aria-label={`Notes for ${player.name}`}
            className="w-full text-sm px-2 py-1.5 rounded border resize-y"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-cream)',
              minHeight: 60,
            }}
          />
        </div>
      )}
    </div>
  )
}
