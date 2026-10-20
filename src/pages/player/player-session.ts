import { useSyncExternalStore } from 'react'
import { transportManager } from '@/transport'
import type { GamePhase, InputType, LayoutAssignments } from '@/db'
import type { ResolvedTheme } from '@/lib/theme'
import type { TeamAnswers } from './team-answer'
import type {
  GameEvent,
  LayoutPayload,
  OpenQuestion,
  RoundAnswers,
  TransportEvent,
} from '@/transport/types'

export type QuestionContent = Extract<GameEvent, { type: 'QUESTION_CONTENT' }>

export type GameStatus = 'waiting' | 'active' | 'paused' | 'ended'

const GAME_STATUSES: readonly string[] = ['waiting', 'active', 'paused', 'ended']

/** The game status a GAME_STATE carries, or `fallback` if it is not one we know. */
export function knownStatus(status: string, fallback: GameStatus | null): GameStatus | null {
  return GAME_STATUSES.includes(status) ? (status as GameStatus) : fallback
}

/** What a player knows about its own place in the game, as told by the host. */
export interface PlayerSession {
  /** Host-assigned id; `null` until JOIN_ACCEPTED. */
  playerId: string | null
  teamId: string | null
  /** How players answer: the buzz button shows only for `buzzer`, options for `choice`. */
  inputType: InputType
  buzzerLocked: boolean
  /** Scores keyed by player and team id, from GAME_STATE and SCORE_UPDATE. */
  scores: Record<string, number>
  /** What the host currently shows players of the question; `null` between questions. */
  question: QuestionContent | null
  /** From GAME_STATE and GAME_STATUS; `null` until the host says. */
  gameStatus: GameStatus | null
  /** The host's latest MESSAGE; a new object per message, so a repeat of the same text is new. */
  message: { text: string } | null
  /** The host's stored layouts for players (see `LAYOUT`); `null` uses the built-in default. */
  layouts: RemoteLayouts | null
  /** The phase the host picks layouts for (see `PHASE`); `null` until it says. */
  phase: GamePhase | null
  /** The host's theme (see `THEME`); `null` keeps this device's own until it arrives. */
  theme: ResolvedTheme | null
  /** The answers revealed in the host's end-of-round review; `null` when none is open. */
  roundAnswers: RoundAnswers | null
  /** The round's earlier questions this player can still answer (see `OPEN_QUESTIONS`). */
  openQuestions: OpenQuestion[]
  /** How the player's team decides its answers, and its current ones (see `TEAM_ANSWERS`). */
  teamAnswers: TeamAnswers | null
}

/**
 * The phase a remote surface picks its layout for: `ended` once the game has ended, even if
 * the host's last `PHASE` was lost as it disconnected; otherwise the host's phase.
 */
export function remotePhase(phase: GamePhase | null, status: GameStatus | null): GamePhase | null {
  return status === 'ended' ? 'ended' : phase
}

/** The layouts a `LAYOUT` carried, and the game they are for. */
export interface RemoteLayouts {
  gameId: string
  layouts: LayoutPayload[]
  /** The layouts the host chose for this surface, per phase. */
  assignments: LayoutAssignments
}

const INITIAL: PlayerSession = {
  playerId: null,
  teamId: null,
  inputType: 'buzzer',
  buzzerLocked: true,
  scores: {},
  question: null,
  gameStatus: null,
  message: null,
  layouts: null,
  phase: null,
  theme: null,
  roundAnswers: null,
  openQuestions: [],
  teamAnswers: null,
}

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
      return {
        ...s,
        inputType: event.state.inputType,
        buzzerLocked: event.state.buzzerLocked,
        scores: event.state.scores,
        gameStatus: knownStatus(event.state.status, s.gameStatus),
      }
    case 'GAME_STATUS':
      return { ...s, gameStatus: event.status }
    case 'BUZZER_LOCK':
      return { ...s, buzzerLocked: true }
    case 'BUZZER_UNLOCK':
      return { ...s, buzzerLocked: false }
    case 'SCORE_UPDATE':
      return { ...s, scores: event.scores }
    case 'QUESTION_CONTENT':
      return event.target === 'players' ? { ...s, question: event } : s
    case 'SLIDE_CHANGE':
      return { ...s, question: null }
    case 'MESSAGE':
      return { ...s, message: event.text ? { text: event.text } : null }
    case 'LAYOUT':
      return event.target === 'player'
        ? {
            ...s,
            layouts: {
              gameId: event.gameId,
              layouts: event.layouts,
              assignments: event.assignments,
            },
          }
        : s
    case 'PHASE':
      return { ...s, phase: event.phase }
    case 'THEME':
      return { ...s, theme: event.theme }
    case 'ROUND_ANSWERS':
      return event.target === 'players' ? { ...s, roundAnswers: event.review } : s
    case 'OPEN_QUESTIONS':
      return { ...s, openQuestions: event.questions }
    case 'TEAM_ANSWERS':
      return {
        ...s,
        teamAnswers: {
          mode: event.mode,
          captainId: event.captainId,
          captainName: event.captainName,
          answers: event.answers,
        },
      }
    default:
      return s
  }
}

/**
 * Clear the previous session and start listening to the host. Call before connecting.
 *
 * @remarks
 * The session lives outside React so the GAME_STATE and QUESTION_CONTENT the host sends
 * right after JOIN_ACCEPTED are kept while the join screen hands over to the lazily loaded
 * play screen.
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

/** The current player session, read outside React (e.g. in a transport callback). */
export function getPlayerSession(): PlayerSession {
  return session
}

/** The current player session; re-renders when the host changes it. */
export function usePlayerSession(): PlayerSession {
  return useSyncExternalStore(subscribe, () => session)
}
