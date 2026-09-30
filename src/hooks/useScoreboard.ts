import { useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { transportManager } from '@/transport'
import { applyScoreDelta } from '@/pages/admin/gamemaster-utils'
import type { Game } from '@/db'

/** A single row in the scoreboard — either a team or an individual player. */
export interface ScoreEntry {
  id: string
  name: string
  score: number
  /** `null` for individual players not on a team. */
  teamId: string | null
  /** Present for team rows; lists each member's individual score. */
  members?: { id: string; name: string; score: number }[]
  kind: 'player' | 'team'
}

/** Return value of {@link useScoreboard}. */
export interface UseScoreboardResult {
  /** Sorted list of scoreboard rows (descending by score). */
  entries: ScoreEntry[]
  /**
   * Apply a score delta to a player or team.
   * Persists the change to IndexedDB and broadcasts a `SCORE_UPDATE` event.
   */
  adjust: (id: string, kind: 'player' | 'team', delta: number) => Promise<void>
  /** Suggested increment step — the lowest difficulty point value, or `1` if none configured. */
  defaultIncrement: number
}

/**
 * Broadcast every player and team score of a game as one `SCORE_UPDATE`.
 * The single emitter for score changes (manual adjustments and adjudication).
 */
export async function broadcastScores(gameId: string): Promise<void> {
  const [players, teams] = await Promise.all([
    db.players.where('gameId').equals(gameId).toArray(),
    db.teams.where('gameId').equals(gameId).toArray(),
  ])
  const scores: Record<string, number> = {}
  for (const p of players) scores[p.id] = p.score
  for (const t of teams) scores[t.id] = t.score
  transportManager.send({ type: 'SCORE_UPDATE', scores })
}

/**
 * Manages scoreboard state for the GM view.
 *
 * @remarks
 * - Reads players and teams live from IndexedDB, so points awarded elsewhere (adjudication)
 *   and players joining mid-game show up immediately.
 * - Provides {@link UseScoreboardResult.adjust} to apply manual +/− delta to a player or team.
 * - Emits a `SCORE_UPDATE` transport event after every adjustment so players see live scores.
 * - Team scores are stored on their own: a player adjustment never changes the team score.
 * - Scores are clamped to a minimum of `0`.
 *
 * @param game - The active {@link Game} record. Only `game.id` is used for DB queries.
 * @returns Sorted entries, the adjust callback, and a suggested increment step.
 *
 * @example
 * ```tsx
 * function Scoreboard({ game }: { game: Game }) {
 *   const { entries, adjust, defaultIncrement } = useScoreboard(game)
 *   return entries.map(e => (
 *     <div key={e.id}>
 *       {e.name}: {e.score}
 *       <button onClick={() => adjust(e.id, e.kind, defaultIncrement)}>+</button>
 *     </div>
 *   ))
 * }
 * ```
 */
export function useScoreboard(game: Game): UseScoreboardResult {
  const players =
    useLiveQuery(() => db.players.where('gameId').equals(game.id).toArray(), [game.id]) ?? []
  const teams =
    useLiveQuery(() => db.teams.where('gameId').equals(game.id).toArray(), [game.id]) ?? []
  const difficulties = useLiveQuery(() => db.difficulties.orderBy('order').toArray(), []) ?? []
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  })

  // Default increment: lowest difficulty score, or 1
  const defaultIncrement = difficulties.length > 0 ? Math.min(...difficulties.map(d => d.score)) : 1

  const adjust = useCallback(async (id: string, kind: 'player' | 'team', delta: number) => {
    const g = gameRef.current

    // Player and team scores are independent; the UI updates via the live queries
    // modify() is an atomic read-modify-write, so a concurrent adjudication isn't overwritten
    const bump = (r: { score: number }) => {
      r.score = applyScoreDelta(r.score, delta)
    }
    const changed =
      kind === 'player'
        ? await db.players.where('id').equals(id).modify(bump)
        : await db.teams.where('id').equals(id).modify(bump)
    if (!changed) return

    await broadcastScores(g.id)
  }, [])

  // Build display entries
  const isTeamMode = teams.length > 0

  let entries: ScoreEntry[]

  if (isTeamMode) {
    // Team rows with player breakdown
    const teamEntries: ScoreEntry[] = teams.map(team => {
      const members = players
        .filter(p => p.teamId === team.id)
        .map(p => ({ id: p.id, name: p.name, score: p.score }))
      return {
        id: team.id,
        name: team.name,
        score: team.score,
        teamId: team.id,
        members,
        kind: 'team',
      }
    })

    // Solo players (no team)
    const soloEntries: ScoreEntry[] = players
      .filter(p => !p.teamId)
      .map(p => ({ id: p.id, name: p.name, score: p.score, teamId: null, kind: 'player' }))

    entries = [...teamEntries, ...soloEntries]
  } else {
    entries = players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      teamId: null,
      kind: 'player',
    }))
  }

  // Sort by score descending
  entries = [...entries].sort((a, b) => b.score - a.score)

  return { entries, adjust, defaultIncrement }
}
