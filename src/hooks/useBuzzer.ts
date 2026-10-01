import { useState, useCallback, useRef, useEffect } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import { broadcastScores } from '@/hooks/useScoreboard'
import type { Game, BuzzEvent, GmDecision } from '@/db'

/** Return value of {@link useBuzzer}. */
export interface UseBuzzerResult {
  /** All buzz events for the current question, in the order the host received them. */
  buzzes: BuzzEvent[]
  /**
   * Filtered subset for display — respects `game.buzzDeduplication`.
   * In `'firstOnly'` mode, only the first buzz per player is shown.
   */
  displayBuzzes: BuzzEvent[]
  /** Whether the buzzer is currently locked (mirrors `game.buzzerLocked`). */
  isLocked: boolean
  /** Toggle the buzzer lock state and broadcast the change to players. */
  toggleLock: () => Promise<void>
  /**
   * Record an incoming buzz from the transport layer.
   * Call this from the GM's transport event handler when a `BUZZ` event arrives.
   */
  handleIncomingBuzz: (payload: {
    playerId: string
    playerName: string
    teamId: string | null
    timestamp: number
    /** Host time from {@link hostNow}, taken as soon as the BUZZ arrives. */
    receivedAt: number
  }) => Promise<void>
  /**
   * Record the GM's ruling on a specific buzz.
   * On `'Correct'`, awards points (if scoring is enabled) and optionally auto-locks.
   * No-op if the buzz is already decided or no longer exists.
   */
  adjudicate: (buzzId: string, decision: GmDecision) => Promise<void>
  /** Delete this game's buzz records for a question. */
  clearBuzzes: (questionId: string) => Promise<void>
}

/**
 * All buzzer logic for the GM side.
 *
 * @remarks
 * This hook does **not** subscribe to transport events itself — the caller is
 * responsible for forwarding `BUZZ` events via `handleIncomingBuzz`. This keeps
 * the single transport subscription in the GameMaster component and avoids
 * duplicate registrations when the hook re-renders.
 *
 * **False-start handling:** If `game.allowFalseStarts` is `false`, buzzes that
 * arrive while the buzzer is locked are silently ignored. If `true`, they are
 * recorded with `isFalseStart: true` and shown in the GM's buzz list.
 *
 * **Auto-lock:** When `game.autoLockOnFirstCorrect` is `true`, the buzzer is
 * locked automatically after the GM rules a buzz as `'Correct'`.
 *
 * **Scoring:** When `game.scoringEnabled` is `true`, a correct ruling increments
 * the player's score by the difficulty point value of the current question.
 *
 * @param game - The active game record. Used for configuration flags and IDs.
 * @param questionId - ID of the currently displayed question, or `null` if none.
 * @param onGameChange - Receives a patch (`buzzerLocked`, `updatedAt`) whenever the hook
 *   changes the lock. The caller should merge it into its current `game` state rather than
 *   replace the whole object, so concurrent updates to other fields are not reverted.
 *
 * @example
 * ```tsx
 * const { displayBuzzes, toggleLock, adjudicate } = useBuzzer(game, currentQuestionId)
 *
 * useTransportEvents(useCallback(event => {
 *   if (event.type === 'BUZZ') {
 *     handleIncomingBuzz(event)
 *   }
 * }, [handleIncomingBuzz]))
 * ```
 */
export function useBuzzer(
  game: Game,
  questionId: string | null,
  onGameChange?: (patch: Partial<Game>) => void
): UseBuzzerResult {
  const [buzzes, setBuzzes] = useState<BuzzEvent[]>([])
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  })

  // Load stored buzzes whenever the question changes, so history survives navigation and reloads
  useEffect(() => {
    let cancelled = false
    const rows = questionId ? loadBuzzesForQuestion(game.id, questionId) : Promise.resolve([])
    void rows.then(r => {
      if (!cancelled) setBuzzes(r)
    })
    return () => {
      cancelled = true
    }
  }, [game.id, questionId])

  // ── Lock / Unlock ────────────────────────────────────────────────────────

  const setLocked = useCallback(
    async (locked: boolean) => {
      // Update the ref and parent state before the DB write so neither a second call nor
      // a re-render during the await (which resyncs gameRef from props) sees the old state
      const patch = { buzzerLocked: locked, updatedAt: Date.now() }
      gameRef.current = { ...gameRef.current, ...patch }
      onGameChange?.(patch)
      await db.games.update(gameRef.current.id, patch)
      transportManager.send(locked ? { type: 'BUZZER_LOCK' } : { type: 'BUZZER_UNLOCK' })
    },
    [onGameChange]
  )

  const toggleLock = useCallback(() => setLocked(!gameRef.current.buzzerLocked), [setLocked])

  // ── Incoming buzz ────────────────────────────────────────────────────────

  const handleIncomingBuzz = useCallback(
    async (payload: {
      playerId: string
      playerName: string
      teamId: string | null
      timestamp: number
      receivedAt: number
    }) => {
      const g = gameRef.current
      if (!questionId) return

      const isFalseStart = g.buzzerLocked

      // Silently ignore if false starts not allowed and buzzer is locked
      if (isFalseStart && !g.allowFalseStarts) return

      const buzz: BuzzEvent = {
        id: crypto.randomUUID(),
        gameId: g.id,
        questionId,
        playerId: payload.playerId,
        playerName: payload.playerName,
        teamId: payload.teamId,
        timestamp: payload.timestamp,
        receivedAt: payload.receivedAt,
        isFalseStart,
        gmDecision: null,
        decidedAt: null,
      }

      await db.buzzEvents.add(buzz)
      setBuzzes(prev => [...prev, buzz].sort(byArrival))
    },
    [questionId]
  )

  // ── Adjudication ─────────────────────────────────────────────────────────

  const adjudicate = useCallback(
    async (buzzId: string, decision: GmDecision) => {
      const g = gameRef.current
      const now = Date.now()

      // One transaction: re-read the buzz so a repeated click is a no-op, and commit
      // the decision and score together. Resolves to null if already decided.
      const result = await db.transaction(
        'rw',
        [db.buzzEvents, db.players, db.teams, db.questions, db.difficulties],
        async (): Promise<{ scored: boolean } | null> => {
          const buzz = await db.buzzEvents.get(buzzId)
          if (!buzz || buzz.gmDecision !== null) return null
          await db.buzzEvents.update(buzzId, { gmDecision: decision, decidedAt: now })

          if (decision !== 'Correct' || !g.scoringEnabled) return { scored: false }
          const player = await db.players.get(buzz.playerId)
          if (!player) return { scored: false }

          // Resolve score increment from question difficulty; fall back to 1
          let increment = 1
          const question = questionId ? await db.questions.get(questionId) : undefined
          if (question?.difficulty) {
            const diff = await db.difficulties.get(question.difficulty)
            if (diff) increment = diff.score
          }
          await db.players.update(buzz.playerId, { score: player.score + increment })

          // Team scores are stored separately; a correct answer counts for the team too
          const team = player.teamId ? await db.teams.get(player.teamId) : undefined
          if (team) await db.teams.update(team.id, { score: team.score + increment })
          return { scored: true }
        }
      )
      if (!result) return

      setBuzzes(prev =>
        prev.map(b => (b.id === buzzId ? { ...b, gmDecision: decision, decidedAt: now } : b))
      )
      if (result.scored) await broadcastScores(g.id)

      // Auto-lock if configured
      if (decision === 'Correct' && g.autoLockOnFirstCorrect && !gameRef.current.buzzerLocked) {
        await setLocked(true)
      }
    },
    [questionId, setLocked]
  )

  // ── Clear ────────────────────────────────────────────────────────────────

  const clearBuzzes = useCallback(async (qId: string) => {
    await db.buzzEvents
      .where('gameId')
      .equals(gameRef.current.id)
      .and(b => b.questionId === qId)
      .delete()
    setBuzzes([])
  }, [])

  // ── Display filtering ─────────────────────────────────────────────────────

  const displayBuzzes =
    game.buzzDeduplication === 'firstOnly'
      ? buzzes.filter((b, i, all) => all.findIndex(x => x.playerId === b.playerId) === i)
      : buzzes

  return {
    buzzes,
    displayBuzzes,
    isLocked: game.buzzerLocked,
    toggleLock,
    handleIncomingBuzz,
    adjudicate,
    clearBuzzes,
  }
}

/**
 * Current host time in epoch milliseconds with sub-millisecond precision.
 *
 * @remarks
 * Built on `performance.now()` so it never steps backwards within a session, and anchored to
 * `performance.timeOrigin` so values stay comparable after a reload.
 */
export function hostNow(): number {
  return performance.timeOrigin + performance.now()
}

/** Sort comparator: the buzz the host received first comes first. */
export function byArrival(a: BuzzEvent, b: BuzzEvent): number {
  // Buzzes stored before receivedAt existed fall back to the client timestamp
  return (a.receivedAt ?? a.timestamp) - (b.receivedAt ?? b.timestamp)
}

/**
 * Load existing buzz events for a question from IndexedDB.
 *
 * @remarks
 * `useBuzzer` calls this whenever the current question changes to hydrate its local state.
 * Results are sorted by host receive time so the display order matches arrival order.
 *
 * @param gameId - The game the buzzes belong to (questions can be shared between games).
 * @param questionId - The question whose buzz history to load.
 * @returns Array of {@link BuzzEvent} records sorted by {@link byArrival}.
 */
export async function loadBuzzesForQuestion(
  gameId: string,
  questionId: string
): Promise<BuzzEvent[]> {
  const rows = await db.buzzEvents
    .where('gameId')
    .equals(gameId)
    .and(b => b.questionId === questionId)
    .toArray()
  return rows.sort(byArrival)
}
