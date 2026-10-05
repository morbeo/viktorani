import { useState } from 'react'
import { Plus, Download, Pencil, StickyNote, Trash2, Check, X } from 'lucide-react'
import { Icon, Button, Input, Modal } from '@/components/ui'
import { canCreateTeam } from '@/pages/admin/gamemaster-utils'
import { resolveIcon, TEAM_ICONS } from '@/components/players-teams/teamIcons'
import { useAppSettings } from '@/hooks/useAppSettings'
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
  onImportFromManaged: () => Promise<void>
  onRenameTeam: (teamId: string, name: string) => Promise<void>
  onDeleteTeam: (teamId: string) => Promise<void>
  onUpdateTeamNotes: (teamId: string, notes: string) => Promise<void>
  /** Called when a team row is clicked (not its action buttons) — selects its members. */
  onSelectTeam: (teamId: string) => void
}

/**
 * Panel for the GM to manage session teams.
 *
 * - Import teams (and their players) from the Players & Teams management page.
 * - Create a new team with a name, colour, and icon (respects game.maxTeams cap).
 * - Rename, delete (unassigns members, doesn't remove them) and add notes to a team.
 * - Click a team row to select its members in the roster.
 *
 * Player-to-team assignment lives in {@link RosterPanel}, not here.
 */
export function TeamManagerPanel({
  game,
  teams,
  players,
  onCreateTeam,
  onImportFromManaged,
  onRenameTeam,
  onDeleteTeam,
  onUpdateTeamNotes,
  onSelectTeam,
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
          {teams.map(team => (
            <TeamRow
              key={team.id}
              game={game}
              team={team}
              memberCount={players.filter(p => p.teamId === team.id).length}
              onRename={name => onRenameTeam(team.id, name)}
              onDelete={() => onDeleteTeam(team.id)}
              onUpdateNotes={notes => onUpdateTeamNotes(team.id, notes)}
              onSelect={() => onSelectTeam(team.id)}
            />
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

interface TeamRowProps {
  game: Game
  team: Team
  memberCount: number
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onUpdateNotes: (notes: string) => Promise<void>
  onSelect: () => void
}

/** One team row: click to select its members, plus rename, notes and delete actions. */
function TeamRow({
  game,
  team,
  memberCount,
  onRename,
  onDelete,
  onUpdateNotes,
  onSelect,
}: TeamRowProps) {
  const [{ confirmDestructive }] = useAppSettings()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(team.name)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState(team.notes)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const TeamIcon = resolveIcon(team.icon)

  function startRename() {
    setName(team.name)
    setRenaming(true)
  }

  async function saveRename() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== team.name) await onRename(trimmed)
    setRenaming(false)
  }

  function handleDeleteClick() {
    if (confirmDestructive) setConfirmingDelete(true)
    else void onDelete()
  }

  return (
    <div className="flex flex-col border-b" style={{ borderColor: 'var(--color-border)' }}>
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
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-black/5"
      >
        <span
          className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-white"
          style={{ background: team.color }}
          aria-hidden
        >
          <Icon icon={TeamIcon} size="sm" />
        </span>

        {renaming ? (
          <input
            autoFocus
            value={name}
            onClick={e => e.stopPropagation()}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') void saveRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            maxLength={40}
            className="flex-1 text-sm px-1.5 py-0.5 rounded border min-w-0"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-cream)' }}
            aria-label={`Rename ${team.name}`}
          />
        ) : (
          <span className="flex-1 text-sm font-medium truncate">{team.name}</span>
        )}

        <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>
          {memberCount}
          {game.maxPerTeam > 0 ? ` / ${game.maxPerTeam}` : ''} player
          {memberCount !== 1 ? 's' : ''}
        </span>

        {renaming ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation()
                void saveRename()
              }}
              aria-label="Save name"
              style={{ padding: '0.25rem' }}
            >
              <Icon icon={Check} size="sm" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation()
                setRenaming(false)
              }}
              aria-label="Cancel rename"
              style={{ padding: '0.25rem' }}
            >
              <Icon icon={X} size="sm" aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation()
                startRename()
              }}
              aria-label={`Rename ${team.name}`}
              title="Rename"
              style={{ padding: '0.25rem' }}
            >
              <Icon icon={Pencil} size="sm" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation()
                setShowNotes(s => !s)
              }}
              aria-label={`${team.name} notes`}
              title="Notes"
              style={{ padding: '0.25rem', color: team.notes ? 'var(--color-gold)' : undefined }}
            >
              <Icon icon={StickyNote} size="sm" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation()
                handleDeleteClick()
              }}
              aria-label={`Delete ${team.name}`}
              title="Delete team"
              style={{ padding: '0.25rem', color: 'var(--color-red)' }}
            >
              <Icon icon={Trash2} size="sm" aria-hidden />
            </Button>
          </>
        )}
      </div>

      {showNotes && (
        <div className="px-4 pb-3" onClick={e => e.stopPropagation()}>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== team.notes) void onUpdateNotes(notes)
            }}
            placeholder="Notes for this team…"
            maxLength={2000}
            aria-label={`Notes for ${team.name}`}
            className="w-full text-sm px-2 py-1.5 rounded border resize-y"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-cream)',
              minHeight: 60,
            }}
          />
        </div>
      )}

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete team?"
        maxWidth="320px"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
            Deleting {team.name}. Its {memberCount} member{memberCount !== 1 ? 's' : ''} will become
            unassigned, not removed from the game.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void onDelete()
                setConfirmingDelete(false)
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
