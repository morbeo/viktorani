import { useState, useCallback, useRef, useEffect } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import type { Game, BuzzEvent, GmDecision } from '@/db'

/** Return value of {@link useBuzzer}. */
export interface UseBuzzerResult {
  /** All buzz events for the current question, sorted by timestamp ascending. */
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
  }) => Promise<void>
  /**
   * Record the GM's ruling on a specific buzz.
   * On `'Correct'`, awards points (if scoring is enabled) and optionally auto-locks.
   */
  adjudicate: (buzzId: string, decision: GmDecision) => Promise<void>
  /** Delete all buzz records for a question (e.g. when moving to the next question). */
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
export function useBuzzer(game: Game, questionId: string | null): UseBuzzerResult {
  const [buzzes, setBuzzes] = useState<BuzzEvent[]>([])
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  })

  // ── Lock / Unlock ────────────────────────────────────────────────────────

  const toggleLock = useCallback(async () => {
    const g = gameRef.current
    const next = !g.buzzerLocked
    await db.games.update(g.id, { buzzerLocked: next, updatedAt: Date.now() })
    transportManager.send(next ? { type: 'BUZZER_LOCK' } : { type: 'BUZZER_UNLOCK' })
  }, [])

  // ── Incoming buzz ────────────────────────────────────────────────────────

  const handleIncomingBuzz = useCallback(
    async (payload: {
      playerId: string
      playerName: string
      teamId: string | null
      timestamp: number
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
        isFalseStart,
        gmDecision: null,
        decidedAt: null,
      }

      await db.buzzEvents.add(buzz)
      setBuzzes(prev => [...prev, buzz].sort((a, b) => a.timestamp - b.timestamp))
    },
    [questionId]
  )

  // ── Adjudication ─────────────────────────────────────────────────────────

  const adjudicate = useCallback(
    async (buzzId: string, decision: GmDecision) => {
      const g = gameRef.current
      const now = Date.now()

      await db.buzzEvents.update(buzzId, { gmDecision: decision, decidedAt: now })
      setBuzzes(prev =>
        prev.map(b => (b.id === buzzId ? { ...b, gmDecision: decision, decidedAt: now } : b))
      )

      if (decision === 'Correct') {
        // Read the buzz from DB to avoid closing over React state
        const buzz = await db.buzzEvents.get(buzzId)
        if (buzz && g.scoringEnabled) {
          const player = await db.players.get(buzz.playerId)
          if (player) {
            // Resolve score increment from question difficulty; fall back to 1
            let increment = 1
            const qId = questionId
            if (qId) {
              const gq = await db.gameQuestions.where('questionId').equals(qId).first()
              if (gq) {
                const question = await db.questions.get(gq.questionId)
                if (question?.difficulty) {
                  const diff = await db.difficulties.get(question.difficulty)
                  if (diff) increment = diff.score
                }
              }
            }
            const newScore = player.score + increment
            await db.players.update(buzz.playerId, { score: newScore })

            // Broadcast updated scores
            const allPlayers = await db.players.where('gameId').equals(g.id).toArray()
            const scores = Object.fromEntries(allPlayers.map(p => [p.id, p.score]))
            transportManager.send({ type: 'SCORE_UPDATE', scores })
          }
        }

        // Auto-lock if configured
        if (g.autoLockOnFirstCorrect && !g.buzzerLocked) {
          await db.games.update(g.id, { buzzerLocked: true, updatedAt: now })
          transportManager.send({ type: 'BUZZER_LOCK' })
        }
      }
    },
    [questionId]
  )

  // ── Clear ────────────────────────────────────────────────────────────────

  const clearBuzzes = useCallback(async (qId: string) => {
    await db.buzzEvents.where('questionId').equals(qId).delete()
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
 * Load existing buzz events for a question from IndexedDB.
 *
 * @remarks
 * Call this when the current question changes to hydrate `useBuzzer`'s local state.
 * Results are sorted by timestamp ascending so the display order matches arrival order.
 *
 * @param questionId - The question whose buzz history to load.
 * @returns Array of {@link BuzzEvent} records sorted by timestamp.
 */
export async function loadBuzzesForQuestion(questionId: string): Promise<BuzzEvent[]> {
  return db.buzzEvents.where('questionId').equals(questionId).sortBy('timestamp')
}
