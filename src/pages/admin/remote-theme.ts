import { GameEventSchemas } from '@/transport/messages'
import type { GameEvent } from '@/transport/types'
import type { ResolvedTheme } from '@/lib/theme'

export type ThemeEvent = Extract<GameEvent, { type: 'THEME' }>

/**
 * The `THEME` the host sends players and screens. Built to pass the schema they check it
 * against: when the logos make it too large, the square logo is left out, then both.
 */
export function buildThemeEvent(theme: ResolvedTheme): ThemeEvent {
  const event: ThemeEvent = { type: 'THEME', theme }
  if (GameEventSchemas.THEME.safeParse(event).success) return event
  const withoutMark: ThemeEvent = {
    type: 'THEME',
    theme: { ...theme, logo: { ...theme.logo, mark: null } },
  }
  if (GameEventSchemas.THEME.safeParse(withoutMark).success) {
    console.warn('[GameMaster] Theme logos are too large to send; leaving out the square one')
    return withoutMark
  }
  console.warn('[GameMaster] Theme logos are too large to send; leaving them out')
  return { type: 'THEME', theme: { ...theme, logo: { wordmark: null, mark: null } } }
}
