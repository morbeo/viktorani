import { useState } from 'react'
import { Plus, Download } from 'lucide-react'
import { Icon, Button, Input, Modal } from '@/components/ui'
import { canCreateTeam, canAssignToTeam } from '@/pages/admin/gamemaster-utils'
import { resolveIcon, TEAM_ICONS } from '@/components/players-teams/teamIcons'
import type { Game, Player, Team } from '@/db'

// Palette of quick-select colours for new teams
const TEAM_COLOURS = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#3498db',
  '#9b59b6',
  '#e91e8c',
  '#607d8b',
  '#795548',
]

interface TeamManagerPanelProps {
  game: Game
  teams: Team[]
  players: Player[]
  onCreateTeam: (name: string, color: string, icon: string) => Promise<void>
  onAssignPlayer: (playerId: string, teamId: string | null) => Promise<void>
  onImportFromManaged: () => Promise<void>
}

/**
 * Panel for the GM to manage session teams during the lobby phase.
 *
 * - Import teams (and their players) from the Players & Teams management page.
 * - Create a new team with a name, colour, and icon (respects game.maxTeams cap).
 * - Assign any player to a team via a dropdown (respects game.maxPerTeam cap).
 * - Players can be removed from a team by selecting "No team".
 */
export function TeamManagerPanel({
  game,
  teams,
  players,
  onCreateTeam,
  onAssignPlayer,
  onImportFromManaged,
}: TeamManagerPanelProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TEAM_COLOURS[0])
  const [newIcon, setNewIcon] = useState('Shield')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showIconPicker, setShowIconPicker] = useState(false)

  const teamAtCap = !canCreateTeam(game, teams.length)
  const SelectedIcon = resolveIcon(newIcon)

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    if (teamAtCap) return
    setCreating(true)
    setError(null)
    try {
      await onCreateTeam(trimmed, newColor, newIcon)
      setNewName('')
      setNewColor(TEAM_COLOURS[0])
      setNewIcon('Shield')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create team')
    } finally {
      setCreating(false)
    }
  }

  async function handleImport() {
    setImporting(true)
    setError(null)
    try {
      await onImportFromManaged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Teams
        </span>
        <div className="flex items-center gap-2">
          {game.maxTeams > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {teams.length} / {game.maxTeams}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleImport()}
            disabled={importing}
            title="Import teams and players from the Players & Teams page"
          >
            <Icon icon={Download} size="sm" />
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>

      {/* Existing teams */}
      {teams.length > 0 && (
        <div className="flex flex-col">
          {teams.map(team => {
            const TeamIcon = resolveIcon(team.icon)
            const memberCount = players.filter(p => p.teamId === team.id).length
            return (
              <div
                key={team.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-white"
                  style={{ background: team.color }}
                  aria-hidden
                >
                  <Icon icon={TeamIcon} size="sm" />
                </span>
                <span className="flex-1 text-sm font-medium truncate">{team.name}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>
                  {memberCount}
                  {game.maxPerTeam > 0 ? ` / ${game.maxPerTeam}` : ''}{' '}
                  player{memberCount !== 1 ? 's' : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Assign player to team */}
      {players.length > 0 && teams.length > 0 && (
        <div
          className="px-4 py-3 border-b flex flex-col gap-2"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
            Assign player
          </span>
          {players.map(player => (
            <div key={player.id} className="flex items-center gap-2">
              <span className="text-sm flex-1 truncate">{player.name}</span>
              <select
                value={player.teamId ?? ''}
                onChange={e => void onAssignPlayer(player.id, e.target.value || null)}
                className="text-xs rounded border px-2 py-1"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-cream)',
                  color: 'var(--color-ink)',
                  maxWidth: 140,
                }}
                aria-label={`Assign ${player.name} to team`}
              >
                <option value="">No team</option>
                {teams.map(team => {
                  const blocked =
                    player.teamId !== team.id &&
                    !canAssignToTeam(game, team, players, player.id)
                  return (
                    <option key={team.id} value={team.id} disabled={blocked}>
                      {team.name}
                      {blocked ? ' (full)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Create new team */}
      <div className="px-4 py-3 flex flex-col gap-3">
        {teamAtCap ? (
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Team limit reached ({game.maxTeams})
          </p>
        ) : (
          <>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
              New team
            </span>

            {/* Colour swatches + icon picker trigger */}
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {TEAM_COLOURS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="w-5 h-5 rounded-full transition-transform"
                    style={{
                      background: c,
                      outline: newColor === c ? `2px solid var(--color-ink)` : 'none',
                      outlineOffset: 2,
                      transform: newColor === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                    aria-label={`Select colour ${c}`}
                    aria-pressed={newColor === c}
                  />
                ))}
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border"
                  style={{ borderColor: 'var(--color-border)', padding: 0 }}
                  title="Custom colour"
                  aria-label="Custom team colour"
                />
              </div>

              {/* Live badge preview — click to pick icon */}
              <button
                onClick={() => setShowIconPicker(true)}
                className="w-8 h-8 rounded flex items-center justify-center text-white shrink-0 transition-opacity hover:opacity-80"
                style={{ background: newColor }}
                title="Pick icon"
                aria-label="Pick team icon"
              >
                <Icon icon={SelectedIcon} size="sm" />
              </button>
            </div>

            {/* Name + create */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label=""
                  placeholder="Team name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleCreate()
                  }}
                  maxLength={40}
                  aria-label="New team name"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleCreate()}
                disabled={creating || !newName.trim()}
                aria-label="Create team"
              >
                <Icon icon={Plus} size="sm" />
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>

            {error && (
              <p className="text-xs" style={{ color: 'var(--color-red)' }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {/* Icon picker modal */}
      <Modal open={showIconPicker} onClose={() => setShowIconPicker(false)} title="Pick icon">
        <div className="flex flex-wrap gap-2" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {TEAM_ICONS.map(({ key, icon: Ic }) => (
            <button
              key={key}
              onClick={() => {
                setNewIcon(key)
                setShowIconPicker(false)
              }}
              className="w-9 h-9 rounded flex items-center justify-center transition-colors"
              style={{
                background: newIcon === key ? newColor : 'var(--color-border)',
                color: newIcon === key ? '#fff' : 'var(--color-ink)',
              }}
              aria-label={key}
              aria-pressed={newIcon === key}
            >
              <Icon icon={Ic} size="sm" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
