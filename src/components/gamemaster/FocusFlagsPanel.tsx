import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { EyeOff } from 'lucide-react'
import { Icon } from '@/components/ui'
import { db } from '@/db'
import type { Game, Player, Team } from '@/db'
import { buildFocusFlags, buildFocusLapses, formatAway } from '@/lib/focus-flags'
import type { FocusLapse } from '@/lib/focus-flags'

export interface FocusFlagsPanelProps {
  game: Pick<Game, 'id'>
  players: Pick<Player, 'id' | 'name' | 'teamId'>[]
  teams: Pick<Team, 'id' | 'name' | 'color'>[]
}

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function where(lapse: FocusLapse): string {
  if (lapse.question === null) return 'Before the first question'
  return lapse.round ? `${lapse.round} · Q${lapse.question}` : `Q${lapse.question}`
}

/**
 * Each team's (or teamless player's) times away from the game screen while the game ran:
 * how often, for how long, and on which question. Flags only, for the host to judge: a
 * locked phone looks the same as a search for the answer.
 */
export function FocusFlagsPanel({ game, players, teams }: FocusFlagsPanelProps) {
  const entries = useLiveQuery(
    () => db.gameLog.where('gameId').equals(game.id).toArray(),
    [game.id]
  )
  const flags = useMemo(
    () => buildFocusFlags(buildFocusLapses(entries ?? []), players, teams),
    [entries, players, teams]
  )
  const total = flags.reduce((n, f) => n + f.lapses.length, 0)
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? 'Unknown player'

  return (
    <div className="rounded-xl border flex flex-col border-border bg-surface">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2 border-border">
        <span
          className="text-xs font-semibold uppercase tracking-wider text-muted"
          title="Times a player's phone left the game while it ran: another app or tab, a locked screen, or a lost focus. Not a penalty."
        >
          Focus flags
        </span>
        {total > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
            {total}
          </span>
        )}
      </div>
      {flags.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">No one has left the game during play.</p>
      ) : (
        <ul className="flex flex-col">
          {flags.map(flag => (
            <li key={flag.id} className="border-b last:border-b-0 border-border">
              <details>
                <summary className="px-4 py-2.5 flex items-center gap-2 cursor-pointer text-sm">
                  <Icon icon={EyeOff} size="sm" className="text-accent shrink-0" aria-hidden />
                  {flag.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: flag.color }}
                      aria-hidden
                    />
                  )}
                  <span className="flex-1 min-w-0 truncate">{flag.name}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {flag.lapses.length === 1 ? '1 time' : `${flag.lapses.length} times`}
                    {flag.awayMs > 0 && ` · ${formatAway(flag.awayMs)}`}
                  </span>
                </summary>
                <ul className="px-4 pb-2.5 flex flex-col gap-1">
                  {flag.lapses.map(lapse => (
                    <li
                      key={`${lapse.playerId}-${lapse.at}`}
                      className="flex items-center gap-2 text-xs text-muted"
                    >
                      <span className="mono tabular-nums">{formatTime(lapse.at)}</span>
                      {flag.color && <span className="truncate">{nameOf(lapse.playerId)}</span>}
                      <span className="flex-1 min-w-0 truncate">{where(lapse)}</span>
                      <span className="tabular-nums">
                        {lapse.awayMs === null ? 'still away' : formatAway(lapse.awayMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
