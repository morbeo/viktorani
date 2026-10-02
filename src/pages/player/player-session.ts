import { useSyncExternalStore } from 'react'
import { transportManager } from '@/transport'
import type { TransportEvent } from '@/transport/types'

/** What a player knows about its own place in the game, as told by the host. */
export interface PlayerSession {
  /** Host-assigned id; `null` until JOIN_ACCEPTED. */
  playerId: string | null
  teamId: string | null
  buzzerLocked: boolean
  /** Scores keyed by player and team id, from GAME_STATE and SCORE_UPDATE. */
  scores: Record<string, number>
}

const INITIAL: PlayerSession = { playerId: null, teamId: null, buzzerLocked: true, scores: {} }

let session = INITIAL
let unsubscribe: (() => void) | null = null
const listeners = new Set<() => void>()

function update(next: PlayerSession) {
  session = next
  listeners.forEach(l => l())
}

/** Apply one host event to a session. Pure function. */
export function reduceSession(s: PlayerSession, event: TransportEvent): PlayerSession {
  switch (event.type) {
    case 'JOIN_ACCEPTED':
      return { ...s, playerId: event.playerId, teamId: event.teamId }
    case 'GAME_STATE':
      return { ...s, buzzerLocked: event.state.buzzerLocked, scores: event.state.scores }
    case 'BUZZER_LOCK':
      return { ...s, buzzerLocked: true }
    case 'BUZZER_UNLOCK':
      return { ...s, buzzerLocked: false }
    case 'SCORE_UPDATE':
      return { ...s, scores: event.scores }
    default:
      return s
  }
}

/**
 * Clear the previous session and start listening to the host. Call before connecting.
 *
 * @remarks
 * The session lives outside React so the GAME_STATE the host sends right after
 * JOIN_ACCEPTED is kept while the join screen hands over to the lazily loaded play screen.
 */
export function startPlayerSession() {
  unsubscribe ??= transportManager.onEvent(event => {
    const next = reduceSession(session, event)
    if (next !== session) update(next)
  })
  update(INITIAL)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current player session; re-renders when the host changes it. */
export function usePlayerSession(): PlayerSession {
  return useSyncExternalStore(subscribe, () => session)
}
