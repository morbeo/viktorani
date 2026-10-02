import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { updateQuestionStatus } from '@/db/games'
import { transportManager } from '@/transport'
import { buildNavSequence, getNavPosition, orderRounds, step } from '@/pages/admin/gamemaster-utils'
import type { Game, GameQuestion } from '@/db'
import type { NavEntry, NavPosition } from '@/pages/admin/gamemaster-utils'

export interface UseNavigationResult {
  seq: NavEntry[]
  pos: NavPosition | null
  goNext: () => Promise<void>
  goPrev: () => Promise<void>
  isReady: boolean
  /** Loaded, but the game has no questions. */
  isEmpty: boolean
}

/**
 * Manages question navigation for an active game session.
 * Loads game questions + rounds once, then exposes prev/next actions
 * that persist to DB and emit SLIDE_CHANGE. Each entry's `questionStatus` stays live,
 * and moving forward from a question nobody answered marks it skipped.
 *
 * onRoundBoundary is called (not via setState in effect) whenever
 * navigation crosses into a new round. The callback runs in event-handler
 * context (inside goNext/goPrev), so calling setState there is safe.
 */
export function useNavigation(
  game: Game | null,
  onRoundBoundary: (entry: NavEntry) => void = () => {}
): UseNavigationResult {
  const [loadedSeq, setSeq] = useState<NavEntry[]>([])
  const [pos, setPos] = useState<NavPosition | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Load sequence on mount / game change
  useEffect(() => {
    if (!game) return
    const g = game // narrow once; safe to capture in async closure
    let cancelled = false

    async function load() {
      const [gqs, allRounds] = await Promise.all([
        db.gameQuestions.where('gameId').equals(g.id).toArray(),
        db.rounds.toArray(),
      ])
      if (cancelled) return

      const built = buildNavSequence(gqs as GameQuestion[], orderRounds(g.roundIds, allRounds))
      setSeq(built)

      // Recover position from game record (survives reload)
      const flatIndex = g.currentQuestionIdx // stored as flat index
      const clamped = Math.max(0, Math.min(built.length - 1, flatIndex))
      setPos(getNavPosition(built, clamped, -1))
      setLoaded(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [game?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = useLiveQuery(
    async () =>
      game
        ? new Map(
            (await db.gameQuestions.where('gameId').equals(game.id).toArray()).map(gq => [
              gq.id,
              gq.status,
            ])
          )
        : undefined,
    [game?.id]
  )
  const seq = useMemo(
    () =>
      loadedSeq.map(e => {
        const status = statuses?.get(e.gameQuestionId) ?? e.questionStatus
        return status === e.questionStatus ? e : { ...e, questionStatus: status }
      }),
    [loadedSeq, statuses]
  )

  const navigate = useCallback(
    async (dir: 1 | -1) => {
      if (!game || !pos || seq.length === 0) return

      const nextFlat = step(seq, pos.flatIndex, dir)
      if (nextFlat === pos.flatIndex) return // already at boundary, nothing to do

      const nextPos = getNavPosition(seq, nextFlat, pos.roundIdx)
      const now = Date.now()

      // Persist to DB
      if (dir === 1) await updateQuestionStatus(seq[pos.flatIndex].gameQuestionId, 'left')
      await db.games.update(game.id, {
        currentRoundIdx: nextPos.roundIdx,
        currentQuestionIdx: nextFlat,
        updatedAt: now,
      })

      // Broadcast to players
      transportManager.send({
        type: 'SLIDE_CHANGE',
        index: nextFlat,
        roundIndex: nextPos.roundIdx,
      })

      setPos(nextPos)

      // Notify caller of round crossing — runs in event-handler context,
      // so the caller can safely call setState in response.
      if (nextPos.isRoundBoundary) {
        onRoundBoundary(seq[nextFlat])
      }
    },
    [game, pos, seq, onRoundBoundary]
  )

  const goNext = useCallback(() => navigate(1), [navigate])
  const goPrev = useCallback(() => navigate(-1), [navigate])

  return {
    seq,
    pos,
    goNext,
    goPrev,
    isReady: loaded && seq.length > 0,
    isEmpty: loaded && seq.length === 0,
  }
}
