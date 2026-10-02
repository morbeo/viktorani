import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { db } from '@/db'
import type { Game } from '@/db'
import { LOG_KIND_LABELS, buildLogRows, downloadGameLog } from '@/lib/game-log-rows'

/** How many rows the panel shows; downloads include every row. */
const LOG_LIMIT = 200

const formatTime = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * Everything that happened in a game, newest first: the game log plus buzzes, rulings and
 * score changes. The whole log can be downloaded as CSV or JSON.
 */
export function GameLogPanel({ game }: { game: Game }) {
  const data = useLiveQuery(async () => {
    const [log, buzzes, scores, players, teams] = await Promise.all([
      db.gameLog.where('gameId').equals(game.id).toArray(),
      db.buzzEvents.where('gameId').equals(game.id).toArray(),
      db.scoreEvents.where('gameId').equals(game.id).toArray(),
      db.players.where('gameId').equals(game.id).toArray(),
      db.teams.where('gameId').equals(game.id).toArray(),
    ])
    return { log, buzzes, scores, players, teams }
  }, [game.id])

  const rows = useMemo(() => {
    if (!data) return []
    const names = new Map<string, string>()
    for (const p of data.players) names.set(p.id, p.name)
    for (const t of data.teams) names.set(t.id, t.name)
    return buildLogRows(data.log, data.buzzes, data.scores, names)
  }, [data])

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Game log
        </span>
        <div className="flex gap-2">
          {(['csv', 'json'] as const).map(format => (
            <Button
              key={format}
              size="sm"
              disabled={rows.length === 0}
              onClick={() => downloadGameLog(rows, game.name, format)}
              title={`Download the game log as ${format.toUpperCase()}`}
            >
              <Icon icon={Download} size="sm" />
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-muted)' }}>
          {data ? 'Nothing has happened yet' : 'Loading…'}
        </p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr
              className="text-xs text-left border-b"
              style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
            >
              <th scope="col" className="px-4 py-2 font-medium">
                Time
              </th>
              <th scope="col" className="py-2 font-medium">
                Event
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Who / details
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, LOG_LIMIT).map(r => (
              <tr key={r.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <td
                  className="px-4 py-1.5 whitespace-nowrap tabular-nums"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {formatTime(r.at)}
                </td>
                <td className="py-1.5 whitespace-nowrap">{LOG_KIND_LABELS[r.kind]}</td>
                <td className="px-4 py-1.5 break-words">
                  {r.who && <span className="font-medium">{r.who}</span>}
                  {r.who && r.details && ' · '}
                  {r.details && <span style={{ color: 'var(--color-muted)' }}>{r.details}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > LOG_LIMIT && (
        <p className="text-xs px-4 py-2" style={{ color: 'var(--color-muted)' }}>
          Showing the latest {LOG_LIMIT} of {rows.length}. Download the log to see all of them.
        </p>
      )}
    </div>
  )
}
