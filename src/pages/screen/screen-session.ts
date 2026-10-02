import type { ScoreboardRow, TransportEvent } from '@/transport/types'
import type { QuestionContent } from '@/pages/player/player-session'
import { isSafeMedia } from '@/pages/player/safe-media'

/** What a networked screen knows about the game, as told by the host. */
export interface ScreenSession {
  status: 'connecting' | 'pending' | 'accepted' | 'rejected'
  /** Set when the host declined the screen. */
  reason: string | null
  /** What the host currently shows on the screen; `null` between questions. */
  content: QuestionContent | null
  rows: ScoreboardRow[]
}

export const INITIAL_SCREEN: ScreenSession = {
  status: 'connecting',
  reason: null,
  content: null,
  rows: [],
}

/** Drop media the screen must not load (see {@link isSafeMedia}). */
function withSafeMedia(content: QuestionContent): QuestionContent {
  const { media, mediaType } = content
  if (media && mediaType && isSafeMedia(media, mediaType)) return content
  return { ...content, media: null, mediaType: null }
}

/** Apply one host event to a screen session. Pure function. */
export function reduceScreen(s: ScreenSession, event: TransportEvent): ScreenSession {
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
    default:
      return s
  }
}
