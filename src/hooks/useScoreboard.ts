import { useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { transportManager } from '@/transport'
import { applyScoreDelta } from '@/pages/admin/gamemaster-utils'
import type { Game, Player, ScoreChangeReason, ScoreEvent, Team } from '@/db'

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
  /** Set a player's or team's score to `score` (a whole number, at least 0), then broadcast. */
  set: (id: string, kind: 'player' | 'team', score: number) => Promise<void>
  /** Suggested increment step — the lowest difficulty point value, or `1` if none configured. */
  defaultIncrement: number
}

/**
 * Read every player and team score of a game from the DB, keyed by player or team id.
 * The one source for the scores sent in `SCORE_UPDATE` and `GAME_STATE`.
 */
export async function readScores(gameId: string): Promise<Record<string, number>> {
  const [players, teams] = await Promise.all([
    db.players.where('gameId').equals(gameId).toArray(),
    db.teams.where('gameId').equals(gameId).toArray(),
  ])
  const scores: Record<string, number> = {}
  for (const p of players) scores[p.id] = p.score
  for (const t of teams) scores[t.id] = t.score
  return scores
}

/** A score change to make with {@link writeScore}. */
export interface ScoreChange {
  gameId: string
  id: string
  kind: 'player' | 'team'
  /** The new score, given the current one. */
  next: (score: number) => number
  reason: ScoreChangeReason
  questionId: string | null
}

/**
 * Write a player's or team's new score and log the change in `scoreEvents`.
 * Call inside a transaction over `players`, `teams` and `scoreEvents`.
 * Resolves to `false` if the player or team doesn't exist or the score is unchanged.
 */
export async function writeScore(change: ScoreChange): Promise<boolean> {
  const { gameId, id, kind, reason, questionId } = change
  const row = kind === 'player' ? await db.players.get(id) : await db.teams.get(id)
  if (!row) return false
  const to = change.next(row.score)
  if (to === row.score) return false
  if (kind === 'player') await db.players.update(id, { score: to })
  else await db.teams.update(id, { score: to })
  await db.scoreEvents.add({
    id: crypto.randomUUID(),
    gameId,
    targetId: id,
    kind,
    name: row.name,
    from: row.score,
    to,
    reason,
    questionId,
    timestamp: Date.now(),
  })
  return true
}

/** {@link writeScore} in its own transaction. */
export function changeScore(change: ScoreChange): Promise<boolean> {
  return db.transaction('rw', [db.players, db.teams, db.scoreEvents], () => writeScore(change))
}

/** A game's score changes, newest first; empty while loading. */
export function useScoreHistory(gameId: string): ScoreEvent[] {
  return (
    useLiveQuery(
      () => db.scoreEvents.where('gameId').equals(gameId).reverse().sortBy('timestamp'),
      [gameId]
    ) ?? []
  )
}

/**
 * Broadcast every player and team score of a game as one `SCORE_UPDATE`.
 * The single emitter for score changes (manual adjustments and adjudication).
 */
export async function broadcastScores(gameId: string): Promise<void> {
  transportManager.send({ type: 'SCORE_UPDATE', scores: await readScores(gameId) })
}

/**
 * Scoreboard rows, highest score first: one per team with its members, plus players
 * without a team, or one per player when the game has no teams.
 */
export function buildScoreEntries(players: Player[], teams: Team[]): ScoreEntry[] {
  let entries: ScoreEntry[]

  if (teams.length > 0) {
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
  return [...entries].sort((a, b) => b.score - a.score)
}

/**
 * Manages scoreboard state for the GM view.
 *
 * @remarks
 * - Reads players and teams live from IndexedDB, so points awarded elsewhere (adjudication)
 *   and players joining mid-game show up immediately.
 * - Provides {@link UseScoreboardResult.adjust} to apply manual +/− delta to a player or team,
 *   and {@link UseScoreboardResult.set} to set a score directly. Both log the change.
 * - Emits a `SCORE_UPDATE` transport event after every adjustment so players see live scores.
 * - Team scores are stored on their own: a player adjustment never changes the team score.
 * - Scores are clamped to a minimum of `0`.
 *
 * @param game - The active {@link Game} record. Only `game.id` is used for DB queries.
 * @param questionId - The question being played, recorded with each change.
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
export function useScoreboard(game: Game, questionId: string | null = null): UseScoreboardResult {
  const players =
    useLiveQuery(() => db.players.where('gameId').equals(game.id).toArray(), [game.id]) ?? []
  const teams =
    useLiveQuery(() => db.teams.where('gameId').equals(game.id).toArray(), [game.id]) ?? []
  const difficulties = useLiveQuery(() => db.difficulties.orderBy('order').toArray(), []) ?? []
  const gameRef = useRef(game)
  const questionIdRef = useRef(questionId)
  useEffect(() => {
    gameRef.current = game
    questionIdRef.current = questionId
  })

  // Default increment: lowest difficulty score, or 1
  const defaultIncrement = difficulties.length > 0 ? Math.min(...difficulties.map(d => d.score)) : 1

  // Player and team scores are independent; the UI updates via the live queries.
  // The read and write share a transaction, so a concurrent adjudication isn't overwritten
  const update = useCallback(
    async (
      id: string,
      kind: 'player' | 'team',
      next: (score: number) => number,
      reason: ScoreChangeReason
    ) => {
      const gameId = gameRef.current.id
      const questionId = questionIdRef.current
      if (!(await changeScore({ gameId, id, kind, next, reason, questionId }))) return
      await broadcastScores(gameId)
    },
    []
  )

  const adjust = useCallback(
    (id: string, kind: 'player' | 'team', delta: number) =>
      update(id, kind, score => applyScoreDelta(score, delta), 'step'),
    [update]
  )

  const set = useCallback(
    (id: string, kind: 'player' | 'team', score: number) =>
      update(id, kind, () => Math.max(0, Math.round(score)), 'set'),
    [update]
  )

  const entries = buildScoreEntries(players, teams)

  return { entries, adjust, set, defaultIncrement }
}
