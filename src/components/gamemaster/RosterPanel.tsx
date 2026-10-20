import { useState } from 'react'
import { Crown, NotebookText, Plus, StickyNote, UserX } from 'lucide-react'
import { Icon, Button, Input } from '@/components/ui'
import { canAssignToTeam, canCreateTeam, isConnected } from '@/pages/admin/gamemaster-utils'
import { resolveIcon, TEAM_COLOURS } from '@/components/players-teams/teamIcons'
import { RosterBulkActionBar } from './RosterBulkActionBar'
import { PRESENCE } from './presence'
import { teamCaptain } from '@/db/answers'
import type { Game, Player, Team } from '@/db'

interface RosterPanelProps {
  game: Game
  players: Player[]
  teams: Team[]
  onKick: (playerId: string) => void
  onAddPlayer: (name: string, teamId: string | null) => Promise<void>
  onAssignPlayer: (playerId: string, teamId: string | null) => Promise<void>
  onAdjustScore: (playerId: string, delta: number) => Promise<void>
  onUpdatePlayerNotes: (playerId: string, notes: string) => Promise<void>
  onCreateTeam: (name: string, color: string, icon: string) => Promise<void>
  /**
   * Makes a member the team's captain. Offered while only captains answer for their team
   * (`Game.teamAnswering` is `captain`).
   */
  onSetCaptain?: (teamId: string, playerId: string) => Promise<void>
  /**
   * Controls the selection from outside (e.g. clicking a team row elsewhere selects its
   * members). Omit both to let the panel manage its own selection.
   */
  selected?: Set<string>
  onSelectedChange?: (next: Set<string>) => void
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
  onCreateTeam,
  onSetCaptain,
  selected: controlledSelected,
  onSelectedChange,
}: RosterPanelProps) {
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set())
  const selected = controlledSelected ?? internalSelected
  const setSelected = onSelectedChange ?? setInternalSelected
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTeamId, setNewTeamId] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [busy, setBusy] = useState(false)

  const onlineCount = players.filter(p => p.presence === 'connected').length
  const hiddenCount = players.filter(p => p.presence === 'hidden').length
  const summary =
    `Connected ${onlineCount}/${players.length}` +
    (hiddenCount > 0 ? ` · ${hiddenCount} tab hidden` : '')

  const groups = teams.map(team => ({
    team,
    members: players.filter(p => p.teamId === team.id),
  }))
  // Captains matter only while they alone answer for their team
  const captains =
    game.teamAnswering === 'captain' && (game.inputType === 'choice' || game.inputType === 'text')
      ? new Map(teams.map(t => [t.id, teamCaptain(t, players)]))
      : null
  const noTeam = players.filter(p => !p.teamId)
  const teamAtCap = !canCreateTeam(game, teams.length)

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

  function selectTeamMembers(teamId: string) {
    setSelected(new Set(players.filter(p => p.teamId === teamId).map(p => p.id)))
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

  async function handleAddTeam() {
    const trimmed = newTeamName.trim()
    if (!trimmed || teamAtCap) return
    setBusy(true)
    try {
      const color = TEAM_COLOURS[teams.length % TEAM_COLOURS.length]
      await onCreateTeam(trimmed, color, 'Shield')
      setNewTeamName('')
      setAddingTeam(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border flex flex-col border-border bg-surface">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2 border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Players</span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: onlineCount > 0 ? 'var(--color-positive)22' : 'var(--color-border)',
              color: onlineCount > 0 ? 'var(--color-positive)' : 'var(--color-muted)',
            }}
            aria-live="polite"
          >
            {summary}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAddingTeam(a => !a)}
            disabled={teamAtCap}
          >
            <Icon icon={Plus} size="sm" />
            Add team
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(a => !a)}>
            <Icon icon={Plus} size="sm" />
            Add player
          </Button>
        </div>
      </div>

      {/* Add team form */}
      {addingTeam && (
        <div className="px-4 py-3 border-b flex items-end gap-2 border-border">
          <div className="flex-1">
            <Input
              label="Name"
              placeholder="Team name"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleAddTeam()
              }}
              maxLength={40}
              autoFocus
              aria-label="New team name"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleAddTeam()}
            disabled={busy || !newTeamName.trim()}
          >
            Add
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAddingTeam(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Add player form */}
      {adding && (
        <div className="px-4 py-3 border-b flex items-end gap-2 border-border">
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
              className="text-xs rounded border px-2 py-2 border-border bg-bg text-text"
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
        <div className="px-4 py-1.5 border-b flex items-center gap-2 border-border">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Select all players"
            className="w-3.5 h-3.5 cursor-pointer"
          />
          <span className="text-xs text-muted">
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>
        </div>
      )}

      {/* Player rows, grouped by team */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 400 }}>
        {players.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-muted">No players yet</p>
          </div>
        ) : (
          <>
            {groups.map(({ team, members }) => (
              <div key={team.id}>
                <TeamGroupHeader
                  team={team}
                  connected={members.filter(p => p.presence === 'connected').length}
                  total={members.length}
                  onSelect={() => selectTeamMembers(team.id)}
                />
                {members.map(player => (
                  <PlayerRow
                    key={player.id}
                    game={game}
                    player={player}
                    players={players}
                    team={team}
                    teams={teams}
                    checked={selected.has(player.id)}
                    onToggle={() => toggleOne(player.id)}
                    onAssignPlayer={onAssignPlayer}
                    onKick={onKick}
                    onUpdateNotes={onUpdatePlayerNotes}
                    captain={
                      captains && onSetCaptain
                        ? {
                            is: captains.get(team.id) === player.id,
                            onSet: () => void onSetCaptain(team.id, player.id),
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}

            {noTeam.length > 0 && (
              <div>
                {teams.length > 0 && (
                  <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted bg-bg">
                    No team
                  </div>
                )}
                {noTeam.map(player => (
                  <PlayerRow
                    key={player.id}
                    game={game}
                    player={player}
                    players={players}
                    team={undefined}
                    teams={teams}
                    checked={selected.has(player.id)}
                    onToggle={() => toggleOne(player.id)}
                    onAssignPlayer={onAssignPlayer}
                    onKick={onKick}
                    onUpdateNotes={onUpdatePlayerNotes}
                  />
                ))}
              </div>
            )}
          </>
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

/** A clickable team header within the grouped roster: click to select all its members. */
function TeamGroupHeader({
  team,
  connected,
  total,
  onSelect,
}: {
  team: Team
  connected: number
  total: number
  onSelect: () => void
}) {
  const TeamIcon = resolveIcon(team.icon)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-label={`Select ${team.name}'s members`}
      className="flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors hover:bg-black/5"
      style={{ background: 'var(--color-bg)' }}
    >
      <span
        className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-white"
        style={{ background: team.color }}
        aria-hidden
      >
        <Icon icon={TeamIcon} size="sm" />
      </span>
      <span className="flex-1 text-xs font-semibold truncate">{team.name}</span>
      <span className="text-xs text-muted">
        Connected {connected}/{total}
      </span>
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
  /** Whether the player is their team's captain, and how to make them it; unset hides it. */
  captain?: { is: boolean; onSet: () => void }
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
  captain,
}: PlayerRowProps) {
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState(player.notes)
  const presence = PRESENCE[player.presence]

  return (
    <div className="border-b last:border-b-0 border-border">
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
          style={{ color: isConnected(player) ? 'var(--color-text)' : 'var(--color-muted)' }}
        >
          {player.name}
        </span>

        {/* Team assignment */}
        <select
          value={player.teamId ?? ''}
          onChange={e => void onAssignPlayer(player.id, e.target.value || null)}
          className="text-xs rounded border px-1.5 py-1 shrink-0 border-border"
          style={{
            background: team ? team.color : 'var(--color-bg)',
            color: team ? '#fff' : 'var(--color-text)',
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

        {/* Captain */}
        {captain && (
          <Button
            variant="ghost"
            size="sm"
            onClick={captain.onSet}
            aria-label={
              captain.is ? `${player.name} is the captain` : `Make ${player.name} captain`
            }
            aria-pressed={captain.is}
            title={captain.is ? 'Captain' : 'Make captain'}
            style={{
              padding: '0.25rem',
              color: captain.is ? 'var(--color-accent)' : 'var(--color-muted)',
            }}
          >
            <Icon icon={Crown} size="sm" aria-hidden />
          </Button>
        )}

        {/* Score */}
        <span className="mono text-sm font-bold w-8 text-right shrink-0 text-text">
          {player.score}
        </span>

        {/* Notes */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNotes(s => !s)}
          aria-label={`${player.name} notes`}
          title="Notes"
          style={{ padding: '0.25rem', color: player.notes ? 'var(--color-accent)' : undefined }}
        >
          <Icon icon={player.notes ? NotebookText : StickyNote} size="sm" aria-hidden />
        </Button>

        {/* Kick button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onKick(player.id)}
          aria-label={`Kick ${player.name}`}
          title={`Kick ${player.name}`}
          className="text-negative"
          style={{ padding: '0.25rem' }}
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
            className="w-full text-sm px-2 py-1.5 rounded border resize-y border-border bg-bg"
            style={{
              minHeight: 60,
            }}
          />
        </div>
      )}
    </div>
  )
}
