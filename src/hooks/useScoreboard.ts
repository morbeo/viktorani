import { useEffect, useCallback, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { logEvent } from '@/db/game-log'
import { transportManager } from '@/transport'
import { applyScoreDelta, toScore } from '@/pages/admin/gamemaster-utils'
import type { Game, Player, RankTies, ScoreChangeReason, ScoreEvent, Team } from '@/db'

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
  /** Place in the standings, from 1; tied rows share one (see {@link Game.rankTies}). */
  place: number
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
  /** Set a player's or team's score to `score` (see `toScore`), then broadcast; ignores NaN. */
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

/** Whether players and screens see the game's held scores rather than the live ones. */
export function holdsScores(game: Pick<Game, 'holdScores' | 'status'>): boolean {
  return game.holdScores && game.status !== 'ended'
}

/**
 * Each player's and team's score as of `at` (epoch ms), from the game's score history: the
 * score after its last change up to then, or before its first change after then. One with
 * no changes keeps its `live` score. `null` means before any change. Pure function.
 */
export function scoresAsOf(
  live: Record<string, number>,
  events: Pick<ScoreEvent, 'targetId' | 'from' | 'to' | 'timestamp'>[],
  at: number | null
): Record<string, number> {
  const cutoff = at ?? -Infinity
  const shown = { ...live }
  const settled = new Set<string>()
  for (const e of [...events].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!(e.targetId in shown) || settled.has(e.targetId)) continue
    if (e.timestamp <= cutoff) {
      shown[e.targetId] = e.to
    } else {
      shown[e.targetId] = e.from
      settled.add(e.targetId)
    }
  }
  return shown
}

/**
 * The score changes players and screens may see: in a game that holds its scores, only those
 * up to the last announcement, so the public log doesn't give away held scores. Pure function.
 */
export function shownScoreEvents<E extends Pick<ScoreEvent, 'timestamp'>>(
  game: Pick<Game, 'holdScores' | 'status' | 'scoresAnnouncedAt'> | undefined,
  events: E[]
): E[] {
  if (!game || !holdsScores(game)) return events
  const at = game.scoresAnnouncedAt ?? -Infinity
  return events.filter(e => e.timestamp <= at)
}

/**
 * The scores players and screens see: the live ones, or with {@link Game.holdScores} the
 * scores as of the host's last announcement, until the game ends.
 */
export async function readShownScores(gameId: string): Promise<Record<string, number>> {
  const [game, live] = await Promise.all([db.games.get(gameId), readScores(gameId)])
  if (!game || !holdsScores(game)) return live
  const events = await db.scoreEvents.where('gameId').equals(gameId).toArray()
  return scoresAsOf(live, events, game.scoresAnnouncedAt)
}

/**
 * Announce the current scores (ADR 0023): with {@link Game.holdScores}, players and screens
 * see the scores as of now until the next announcement. Resolves to the game's change.
 */
export async function announceScores(gameId: string): Promise<Pick<Game, 'scoresAnnouncedAt'>> {
  const patch = { scoresAnnouncedAt: Date.now() }
  await db.games.update(gameId, patch)
  logEvent(gameId, 'scores_announced')
  await broadcastScores(gameId)
  return patch
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

/**
 * Apply a score delta to a player or team and broadcast the result, outside the
 * {@link useScoreboard} hook (e.g. from the roster's bulk actions, with no current question).
 */
export async function adjustScore(
  gameId: string,
  id: string,
  kind: 'player' | 'team',
  delta: number
): Promise<void> {
  const changed = await changeScore({
    gameId,
    id,
    kind,
    next: score => applyScoreDelta(score, delta),
    reason: 'step',
    questionId: null,
  })
  if (changed) await broadcastScores(gameId)
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
 * Broadcast every player and team score of a game as one `SCORE_UPDATE`, as players may see
 * them ({@link readShownScores}). The single emitter for score changes (manual adjustments
 * and adjudication), and for announcements.
 */
export async function broadcastScores(gameId: string): Promise<void> {
  transportManager.send({ type: 'SCORE_UPDATE', scores: await readShownScores(gameId) })
}

/**
 * How many questions each player and team answered correctly, keyed by id, from a game's
 * score history: correct answers scored, less those taken back. Pure function.
 */
export function correctCounts(
  events: ReadonlyArray<Pick<ScoreEvent, 'targetId' | 'reason'>>
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of events) {
    const step = e.reason === 'correct' ? 1 : e.reason === 'retract' ? -1 : 0
    if (step) counts[e.targetId] = (counts[e.targetId] ?? 0) + step
  }
  return counts
}

/** How {@link buildScoreEntries} places tied scores. */
export interface RankOptions {
  rankTies: RankTies
  /** Correct answers per player and team ({@link correctCounts}), for `mostCorrect`. */
  correct: Record<string, number>
}

/**
 * Scoreboard rows, highest score first: one per team with its members, plus players
 * without a team, or one per player when the game has no teams. Rows with the same score
 * share a place, unless `rank` breaks the tie by correct answers.
 */
export function buildScoreEntries(
  players: Player[],
  teams: Team[],
  rank: RankOptions = { rankTies: 'share', correct: {} }
): ScoreEntry[] {
  let entries: Omit<ScoreEntry, 'place'>[]

  if (teams.length > 0) {
    // Team rows with player breakdown
    const teamEntries: Omit<ScoreEntry, 'place'>[] = teams.map(team => {
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
    const soloEntries: Omit<ScoreEntry, 'place'>[] = players
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

  const byCorrect = rank.rankTies === 'mostCorrect'
  const correct = (id: string) => (byCorrect ? (rank.correct[id] ?? 0) : 0)
  const sorted = [...entries].sort((a, b) => b.score - a.score || correct(b.id) - correct(a.id))
  const placed: ScoreEntry[] = []
  sorted.forEach((entry, i) => {
    const prev = placed[i - 1]
    const tied = prev && prev.score === entry.score && correct(prev.id) === correct(entry.id)
    placed.push({ ...entry, place: tied ? prev.place : i + 1 })
  })
  return placed
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
  const correct = useLiveQuery(
    async () =>
      game.rankTies === 'mostCorrect'
        ? correctCounts(await db.scoreEvents.where('gameId').equals(game.id).toArray())
        : {},
    [game.id, game.rankTies]
  )
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
    async (id: string, kind: 'player' | 'team', score: number) => {
      const to = toScore(score)
      if (to !== null) await update(id, kind, () => to, 'set')
    },
    [update]
  )

  const entries = buildScoreEntries(players, teams, {
    rankTies: game.rankTies,
    correct: correct ?? {},
  })

  return { entries, adjust, set, defaultIncrement }
}
