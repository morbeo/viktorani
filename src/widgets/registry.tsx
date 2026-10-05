import { z } from 'zod'
import type { ComponentType } from 'react'
import type { WidgetType } from '@/db'
import { QrCodePanel } from '@/components/gamemaster/QrCodePanel'
import { RoundInfo } from '@/components/gamemaster/RoundInfo'
import { AnnouncementBanner } from '@/pages/player/AnnouncementBanner'
import {
  ScreenAnnouncement,
  ScreenAnswers,
  ScreenMedia,
  ScreenQuestion,
} from '@/components/screen/ScreenView'
import { WidgetPlaceholder } from './placeholder'
import type { WidgetDefinition, WidgetTarget } from './types'

function placeholderFor(label: string): ComponentType {
  function Placeholder() {
    return <WidgetPlaceholder label={label} />
  }
  Placeholder.displayName = `${label}Placeholder`
  return Placeholder
}

/**
 * One registry entry. Targets in `overrides` get their real, already-extracted component;
 * the rest get a placeholder, since they still need live game data #410's `LayoutRenderer`
 * will supply.
 */
function widget(
  type: WidgetType,
  label: string,
  allowedTargets: readonly WidgetTarget[],
  preferredWidth: 'full' | 'half',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides: Partial<Record<WidgetTarget, ComponentType<any>>> = {}
): WidgetDefinition {
  const Placeholder = placeholderFor(label)
  const components: WidgetDefinition['components'] = {}
  for (const target of allowedTargets) components[target] = overrides[target] ?? Placeholder
  return {
    type,
    label,
    allowedTargets,
    preferredWidth,
    configSchema: z.strictObject({}),
    defaultConfig: {},
    components,
  }
}

/** Every {@link WidgetType}, with its metadata and a component (real or placeholder) per target. */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  buzzer: widget('buzzer', 'Buzzer', ['admin', 'player'], 'half'),
  question: widget('question', 'Question', ['admin', 'player', 'screen'], 'full', {
    screen: ScreenQuestion,
  }),
  answers: widget('answers', 'Answers', ['admin', 'player', 'screen'], 'full', {
    screen: ScreenAnswers,
  }),
  media: widget('media', 'Media', ['admin', 'player', 'screen'], 'full', { screen: ScreenMedia }),
  timer: widget('timer', 'Timer', ['admin', 'player', 'screen'], 'half'),
  buzz_order: widget('buzz_order', 'Buzz order', ['admin'], 'half'),
  scoreboard: widget('scoreboard', 'Scoreboard', ['admin', 'screen'], 'half'),
  leaderboard: widget('leaderboard', 'Leaderboard', ['screen', 'scoreboard'], 'half'),
  player_list: widget('player_list', 'Player list', ['admin'], 'half'),
  round_info: widget('round_info', 'Round info', ['admin'], 'full', { admin: RoundInfo }),
  text: widget('text', 'Text', ['admin', 'player', 'screen', 'scoreboard'], 'half'),
  qr_code: widget('qr_code', 'QR code', ['admin'], 'half', { admin: QrCodePanel }),
  announcement: widget('announcement', 'Announcement', ['admin', 'player', 'screen'], 'full', {
    player: AnnouncementBanner,
    screen: ScreenAnnouncement,
  }),
  image: widget('image', 'Image', ['admin', 'player', 'screen', 'scoreboard'], 'half'),
  game_controls: widget('game_controls', 'Game controls', ['admin'], 'full'),
  progress: widget('progress', 'Progress', ['admin', 'player', 'screen'], 'full'),
}
