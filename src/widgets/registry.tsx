import { z } from 'zod'
import type { ComponentType } from 'react'
import type { WidgetType } from '@/db'
import { GRID_COLUMNS, type GridSize } from '@/lib/layout-grid'
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

const FULL: GridSize = { w: GRID_COLUMNS, h: 1 }
const HALF: GridSize = { w: GRID_COLUMNS / 2, h: 1 }

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
  preferredSize: GridSize,
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
    preferredSize,
    configSchema: z.strictObject({}),
    defaultConfig: {},
    components,
  }
}

/** Every {@link WidgetType}, with its metadata and a component (real or placeholder) per target. */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  buzzer: widget('buzzer', 'Buzzer', ['gamemaster', 'player'], HALF),
  question: widget('question', 'Question', ['gamemaster', 'player', 'screen'], FULL, {
    screen: ScreenQuestion,
  }),
  answers: widget('answers', 'Answers', ['gamemaster', 'player', 'screen'], FULL, {
    screen: ScreenAnswers,
  }),
  media: widget('media', 'Media', ['gamemaster', 'player', 'screen'], FULL, {
    screen: ScreenMedia,
  }),
  timer: widget('timer', 'Timer', ['gamemaster', 'player', 'screen'], HALF),
  buzz_order: widget('buzz_order', 'Buzz order', ['gamemaster'], HALF),
  scoreboard: widget('scoreboard', 'Scoreboard', ['gamemaster', 'screen'], HALF),
  leaderboard: widget('leaderboard', 'Leaderboard', ['screen', 'scoreboard'], HALF),
  player_list: widget('player_list', 'Player list', ['gamemaster'], HALF),
  round_info: widget('round_info', 'Round info', ['gamemaster'], FULL, { gamemaster: RoundInfo }),
  text: widget('text', 'Text', ['gamemaster', 'player', 'screen', 'scoreboard'], HALF),
  qr_code: widget('qr_code', 'QR code', ['gamemaster'], HALF, { gamemaster: QrCodePanel }),
  announcement: widget('announcement', 'Announcement', ['gamemaster', 'player', 'screen'], FULL, {
    player: AnnouncementBanner,
    screen: ScreenAnnouncement,
  }),
  image: widget('image', 'Image', ['gamemaster', 'player', 'screen', 'scoreboard'], HALF),
  game_controls: widget('game_controls', 'Game controls', ['gamemaster'], FULL),
  progress: widget('progress', 'Progress', ['gamemaster', 'player', 'screen'], FULL),
}
