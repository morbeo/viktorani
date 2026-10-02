import { CircleDot, EyeOff, LogOut, UserX, WifiOff, type LucideIcon } from 'lucide-react'
import { Icon, Button } from '@/components/ui'
import { resolveIcon } from '@/components/players-teams/teamIcons'
import { isConnected } from '@/pages/admin/gamemaster-utils'
import type { Player, PlayerPresence, Team } from '@/db'

interface RosterPanelProps {
  players: Player[]
  teams: Team[]
  onKick: (playerId: string) => void
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
  left: { icon: LogOut, color: 'var(--color-muted)', label: 'Left', meaning: 'They left the game.' },
  kicked: { icon: UserX, color: 'var(--color-red)', label: 'Kicked', meaning: 'You removed them.' },
}

/**
 * Live roster panel for the GameMaster lobby.
 * Shows each player's name, team badge, score, and presence (see {@link PRESENCE}).
 * Provides a kick action.
 *
 * The header counts connected players, with tab-hidden and disconnected ones listed apart.
 */
export function RosterPanel({ players, teams, onKick }: RosterPanelProps) {
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
          Players
        </span>
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
      </div>

      {/* Player rows */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 320 }}>
        {players.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              No players yet
            </p>
          </div>
        ) : (
          players.map(player => {
            const team = player.teamId ? teamMap.get(player.teamId) : undefined
            const presence = PRESENCE[player.presence]
            return (
              <div
                key={player.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
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

                {/* Team badge */}
                {team ? (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-white shrink-0"
                    style={{ background: team.color, maxWidth: 108 }}
                  >
                    <Icon icon={resolveIcon(team.icon)} size="sm" aria-hidden />
                    <span className="truncate">{team.name}</span>
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    no team
                  </span>
                )}

                {/* Score */}
                <span
                  className="mono text-sm font-bold w-8 text-right shrink-0"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {player.score}
                </span>

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
            )
          })
        )}
      </div>
    </div>
  )
}
