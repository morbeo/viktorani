import type { GamePhase } from '@/db'
import type { ResolvedTheme } from '@/lib/theme'
import type {
  LogEntry,
  RoundAnswers,
  ScoreboardRow,
  ScreenSurface,
  TransportEvent,
} from '@/transport/types'
import { knownStatus } from '@/pages/player/player-session'
import type { GameStatus, QuestionContent, RemoteLayouts } from '@/pages/player/player-session'
import { isSafeMedia } from '@/pages/player/safe-media'

/** What a networked screen knows about the game, as told by the host. */
export interface ScreenSession {
  status: 'connecting' | 'pending' | 'accepted' | 'rejected'
  /** Set when the host declined the screen. */
  reason: string | null
  /** What the host currently shows on the screen; `null` between questions. */
  content: QuestionContent | null
  rows: ScoreboardRow[]
  /** From GAME_STATE and GAME_STATUS; `null` until the host says. */
  gameStatus: GameStatus | null
  /** The host's latest MESSAGE to the screens; `null` when cleared. */
  message: string | null
  /** The most recent public game-log entries, newest first. */
  logEntries: LogEntry[]
  /** The host's layouts for this surface (see `LAYOUT`); `null` uses the built-in default. */
  layouts: RemoteLayouts | null
  /** The phase the host picks layouts for (see `PHASE`); `null` until it says. */
  phase: GamePhase | null
  /** The host's theme (see `THEME`); `null` keeps this device's own until it arrives. */
  theme: ResolvedTheme | null
  /** The answers revealed in the host's end-of-round review; `null` when none is open. */
  roundAnswers: RoundAnswers | null
}

export const INITIAL_SCREEN: ScreenSession = {
  status: 'connecting',
  reason: null,
  content: null,
  rows: [],
  gameStatus: null,
  message: null,
  logEntries: [],
  layouts: null,
  phase: null,
  theme: null,
  roundAnswers: null,
}

/** Drop media the screen must not load (see {@link isSafeMedia}). */
function withSafeMedia(content: QuestionContent): QuestionContent {
  const { media, mediaType } = content
  if (media && mediaType && isSafeMedia(media, mediaType)) return content
  return { ...content, media: null, mediaType: null }
}

/**
 * Apply one host event to a screen session. Pure function. `surface` is what the device
 * shows: it keeps only the `LAYOUT` for that surface.
 */
export function reduceScreen(
  s: ScreenSession,
  event: TransportEvent,
  surface: ScreenSurface = 'screen'
): ScreenSession {
  switch (event.type) {
    case 'JOIN_PENDING':
      return { ...s, status: 'pending' }
    case 'SCREEN_ACCEPTED':
      return { ...s, status: 'accepted' }
    case 'JOIN_REJECTED':
      return { ...s, status: 'rejected', reason: event.reason }
    case 'QUESTION_CONTENT':
      return event.target === 'screen' ? { ...s, content: withSafeMedia(event) } : s
    case 'SLIDE_CHANGE':
      return { ...s, content: null }
    case 'SCOREBOARD':
      return { ...s, rows: event.rows }
    case 'GAME_STATE':
      return { ...s, gameStatus: knownStatus(event.state.status, s.gameStatus) }
    case 'GAME_STATUS':
      return { ...s, gameStatus: event.status }
    case 'MESSAGE':
      return { ...s, message: event.text || null }
    case 'LOG':
      return { ...s, logEntries: event.entries }
    case 'LAYOUT':
      return event.target === surface
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
      return event.target === 'screen' ? { ...s, roundAnswers: event.review } : s
    default:
      return s
  }
}
