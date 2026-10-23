import { db } from '@/db'
import { shownScoreEvents } from '@/hooks/useScoreboard'
import { buildLogRows, toPublicLogEntries } from '@/lib/game-log-rows'
import { MAX_LOG_ENTRIES } from '@/transport/messages'
import type { LogEntry } from '@/transport/types'

/**
 * The public feed of game `gameId`'s log, newest first, as screens and scoreboards show it
 * (see `PUBLIC_LOG_KINDS`). With held scores, score changes since the last announcement are
 * left out.
 */
export async function readPublicLog(gameId: string): Promise<LogEntry[]> {
  const [game, log, buzzes, scores, players, teams] = await Promise.all([
    db.games.get(gameId),
    db.gameLog.where('gameId').equals(gameId).toArray(),
    db.buzzEvents.where('gameId').equals(gameId).toArray(),
    db.scoreEvents.where('gameId').equals(gameId).toArray(),
    db.players.where('gameId').equals(gameId).toArray(),
    db.teams.where('gameId').equals(gameId).toArray(),
  ])
  const names = new Map<string, string>()
  for (const p of players) names.set(p.id, p.name)
  for (const t of teams) names.set(t.id, t.name)
  const rows = buildLogRows(log, buzzes, shownScoreEvents(game, scores), names)
  return toPublicLogEntries(rows, MAX_LOG_ENTRIES)
}
