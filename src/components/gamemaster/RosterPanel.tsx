import { CircleDot, Circle, UserX } from 'lucide-react'
import { Icon, Badge, Button } from '@/components/ui'
import type { Player, Team } from '@/db'

interface RosterPanelProps {
  players: Player[]
  teams: Team[]
  onKick: (playerId: string) => void
}

/**
 * Live roster panel for the GameMaster lobby.
 * Shows each connected player's name, team badge, score, and online/away status.
 * Provides a kick action that marks the player as away.
 *
 * Count badge in the header reflects only non-away (online) players.
 */
export function RosterPanel({ players, teams, onKick }: RosterPanelProps) {
  const teamMap = new Map(teams.map(t => [t.id, t]))
  const onlineCount = players.filter(p => !p.isAway).length

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
          aria-label={`${onlineCount} player${onlineCount !== 1 ? 's' : ''} online`}
        >
          {onlineCount} online
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
            return (
              <div
                key={player.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {/* Online/away dot */}
                <span
                  style={{ color: player.isAway ? 'var(--color-muted)' : 'var(--color-green)' }}
                  aria-label={player.isAway ? 'Away' : 'Online'}
                  className="shrink-0"
                >
                  <Icon
                    icon={player.isAway ? Circle : CircleDot}
                    size="sm"
                    aria-hidden={false}
                  />
                </span>

                {/* Name */}
                <span
                  className="flex-1 text-sm truncate"
                  style={{ color: player.isAway ? 'var(--color-muted)' : 'var(--color-ink)' }}
                >
                  {player.name}
                </span>

                {/* Team badge */}
                {team ? (
                  <Badge
                    style={{
                      background: team.color + '22',
                      color: team.color,
                      border: `1px solid ${team.color}44`,
                      maxWidth: 96,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {team.name}
                  </Badge>
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
