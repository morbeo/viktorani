import { useState, useCallback, useRef, useEffect } from 'react'
import { db } from '@/db'
import { transportManager } from '@/transport'
import type { Game, BuzzEvent, GmDecision } from '@/db'

export interface UseBuzzerResult {
  buzzes: BuzzEvent[]
  /** Filtered for display — respects game.buzzDeduplication */
  displayBuzzes: BuzzEvent[]
  isLocked: boolean
  toggleLock: () => Promise<void>
  handleIncomingBuzz: (payload: {
    playerId: string
    playerName: string
    teamId: string | null
    timestamp: number
  }) => Promise<void>
  adjudicate: (buzzId: string, decision: GmDecision) => Promise<void>
  clearBuzzes: (questionId: string) => Promise<void>
}

/**
 * All buzzer logic for the GM side.
 *
 * - Receives incoming BUZZ transport events and writes BuzzEvents to DB.
 * - Handles false-start rules, deduplication, adjudication, and auto-lock.
 * - Does NOT subscribe to transport itself — caller feeds events via
 *   handleIncomingBuzz so GameMaster controls the single transport subscription.
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
 * Load existing buzz events for a question from DB.
 * Call this when question changes to hydrate useBuzzer's state.
 */
export async function loadBuzzesForQuestion(questionId: string): Promise<BuzzEvent[]> {
  return db.buzzEvents.where('questionId').equals(questionId).sortBy('timestamp')
}
