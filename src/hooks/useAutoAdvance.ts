import { useCallback, useEffect, useRef, useState } from 'react'
import type { Game, Timer } from '@/db'

/** Why the game is about to move on by itself. */
export type AutoAdvanceReason = 'correct' | 'timer'

/** A move to the next question that will happen at `at` (epoch ms) unless cancelled. */
export interface PendingAdvance {
  reason: AutoAdvanceReason
  at: number
  /** Whole seconds left, for the host's notice. */
  secondsLeft: number
}

export interface UseAutoAdvanceOptions {
  game: Pick<
    Game,
    'status' | 'autoAdvanceOnCorrect' | 'autoAdvanceOnTimerExpiry' | 'autoAdvanceDelaySeconds'
  >
  /** Flat index of the question shown, or `null` before navigation loads. */
  flatIndex: number | null
  /** No question follows the one shown, so there is nowhere to advance to. */
  isLast: boolean
  timers: Timer[]
  onAdvance: () => void
}

export interface UseAutoAdvanceResult {
  /** The advance that is counting down, or `null`. */
  pending: PendingAdvance | null
  /** Call after a correct ruling on the question shown. */
  onCorrect: () => void
  /** Keep the question shown; the countdown does not come back for it. */
  cancel: () => void
}

interface Armed {
  reason: AutoAdvanceReason
  flatIndex: number
  at: number
  /** Before this moment the countdown is armed but not shown (a running timer). */
  showFrom: number
}

const key = (a: Armed) => `${a.reason}:${a.flatIndex}:${a.at}`

/** When a running question timer runs out, or `null` if none is running. */
function questionTimerExpiry(timers: Timer[]): number | null {
  const ends = timers
    .filter(t => t.autoReset === 'question' && !t.paused && t.startedAt !== null)
    .map(t => (t.startedAt as number) + t.remaining * 1000)
  return ends.length > 0 ? Math.min(...ends) : null
}

/**
 * Moves to the next question a few seconds after a correct ruling or after the question
 * timer runs out, when the game's settings ask for it (#424). The host sees the countdown
 * and can cancel it. Navigating by hand, pausing or ending the game drops it, so it never
 * races the host's own navigation, and the last question never advances.
 */
export function useAutoAdvance({
  game,
  flatIndex,
  isLast,
  timers,
  onAdvance,
}: UseAutoAdvanceOptions): UseAutoAdvanceResult {
  const delayMs = game.autoAdvanceDelaySeconds * 1000
  const [correct, setCorrect] = useState<Armed | null>(null)
  const [cancelled, setCancelled] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // A timer that ran out before this page opened (a reload) doesn't move the game on
  const [since] = useState(() => Date.now())

  const onCorrect = useCallback(() => {
    if (!game.autoAdvanceOnCorrect || flatIndex === null) return
    const at = Date.now() + delayMs
    setCorrect({ reason: 'correct', flatIndex, at, showFrom: 0 })
  }, [game.autoAdvanceOnCorrect, flatIndex, delayMs])

  const expiry = game.autoAdvanceOnTimerExpiry ? questionTimerExpiry(timers) : null
  const byTimer: Armed | null =
    expiry !== null && expiry >= since && flatIndex !== null
      ? { reason: 'timer', flatIndex, at: expiry + delayMs, showFrom: expiry }
      : null

  // A correct ruling only counts on the question it was made on
  const candidates = [correct?.flatIndex === flatIndex ? correct : null, byTimer].filter(
    (a): a is Armed => a !== null && key(a) !== cancelled
  )
  const armed =
    game.status === 'active' && !isLast && candidates.length > 0
      ? candidates.reduce((a, b) => (b.at < a.at ? b : a))
      : null
  const armedKey = armed ? key(armed) : null
  const armedAt = armed?.at ?? null

  const cancel = useCallback(() => setCancelled(armedKey), [armedKey])

  const onAdvanceRef = useRef(onAdvance)
  useEffect(() => {
    onAdvanceRef.current = onAdvance
  }, [onAdvance])

  // Advance when the countdown ends, and tick so the notice counts down
  useEffect(() => {
    if (armedAt === null) return
    const advance = setTimeout(() => onAdvanceRef.current(), Math.max(0, armedAt - Date.now()))
    const tick = setInterval(() => setNow(Date.now()), 250)
    return () => {
      clearTimeout(advance)
      clearInterval(tick)
    }
  }, [armedKey, armedAt])

  const pending: PendingAdvance | null =
    armed && now >= armed.showFrom
      ? {
          reason: armed.reason,
          at: armed.at,
          secondsLeft: Math.max(0, Math.ceil((armed.at - now) / 1000)),
        }
      : null

  return { pending, onCorrect, cancel }
}
