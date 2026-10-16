import { z } from 'zod'
import type { ComponentType } from 'react'
import type { WidgetType } from '@/db'
import { GRID_COLUMNS, type GridSize } from '@/lib/layout-grid'
import {
  GamemasterBuzzOrderWidget,
  GamemasterBuzzerWidget,
  GamemasterGameControlsWidget,
  GamemasterLogWidget,
  GamemasterPlayerListWidget,
  GamemasterProgressWidget,
  GamemasterQrCodeWidget,
  GamemasterQuestionWidget,
  GamemasterRoundInfoWidget,
  GamemasterScoreboardWidget,
  GamemasterTimerWidget,
} from '@/components/gamemaster/gamemaster-widgets'
import {
  PlayerAnnouncementWidget,
  PlayerBuzzerWidget,
  PlayerQuestionWidget,
  PlayerTimerWidget,
} from '@/pages/player/player-widgets'
import {
  ScreenAnnouncementWidget,
  ScreenAnswersWidget,
  ScreenHeadingWidget,
  ScreenLogWidget,
  ScreenMediaWidget,
  ScreenQuestionWidget,
  ScreenScoresWidget,
  ScreenTimersWidget,
} from '@/components/screen/screen-widgets'
import { ImageConfigSchema, TextConfigSchema } from './content-config'
import { ImageWidget, TextWidget } from './content-widgets'
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
 * One registry entry. Targets in `overrides` get their real widget adapter; the rest get a
 * placeholder until the designer (#412) needs them. The default config is what
 * `configSchema` makes of `{}`, so every setting needs a default.
 */
function widget(
  type: WidgetType,
  label: string,
  allowedTargets: readonly WidgetTarget[],
  preferredSize: GridSize,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides: Partial<Record<WidgetTarget, ComponentType<any>>> = {},
  configSchema: z.ZodType<Record<string, unknown>> = z.strictObject({})
): WidgetDefinition {
  const Placeholder = placeholderFor(label)
  const components: WidgetDefinition['components'] = {}
  for (const target of allowedTargets) components[target] = overrides[target] ?? Placeholder
  return {
    type,
    label,
    allowedTargets,
    preferredSize,
    configSchema,
    defaultConfig: configSchema.parse({}),
    components,
  }
}

/** Every {@link WidgetType}, with its metadata and a component (real or placeholder) per target. */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  buzzer: widget('buzzer', 'Buzzer', ['gamemaster', 'player'], HALF, {
    gamemaster: GamemasterBuzzerWidget,
    player: PlayerBuzzerWidget,
  }),
  question: widget('question', 'Question', ['gamemaster', 'player', 'screen'], FULL, {
    gamemaster: GamemasterQuestionWidget,
    player: PlayerQuestionWidget,
    screen: ScreenQuestionWidget,
  }),
  answers: widget('answers', 'Answers', ['gamemaster', 'player', 'screen'], FULL, {
    screen: ScreenAnswersWidget,
  }),
  media: widget('media', 'Media', ['gamemaster', 'player', 'screen'], FULL, {
    screen: ScreenMediaWidget,
  }),
  timer: widget('timer', 'Timer', ['gamemaster', 'player', 'screen'], HALF, {
    gamemaster: GamemasterTimerWidget,
    player: PlayerTimerWidget,
    screen: ScreenTimersWidget,
  }),
  buzz_order: widget('buzz_order', 'Buzz order', ['gamemaster'], HALF, {
    gamemaster: GamemasterBuzzOrderWidget,
  }),
  scoreboard: widget('scoreboard', 'Scoreboard', ['gamemaster', 'screen'], HALF, {
    gamemaster: GamemasterScoreboardWidget,
    screen: ScreenScoresWidget,
  }),
  leaderboard: widget('leaderboard', 'Leaderboard', ['screen', 'scoreboard'], HALF),
  player_list: widget('player_list', 'Player list', ['gamemaster'], HALF, {
    gamemaster: GamemasterPlayerListWidget,
  }),
  round_info: widget('round_info', 'Round info', ['gamemaster', 'screen'], FULL, {
    gamemaster: GamemasterRoundInfoWidget,
    screen: ScreenHeadingWidget,
  }),
  text: widget(
    'text',
    'Text',
    ['gamemaster', 'player', 'screen', 'scoreboard'],
    HALF,
    { gamemaster: TextWidget, player: TextWidget, screen: TextWidget, scoreboard: TextWidget },
    TextConfigSchema
  ),
  qr_code: widget('qr_code', 'QR code', ['gamemaster'], HALF, {
    gamemaster: GamemasterQrCodeWidget,
  }),
  announcement: widget('announcement', 'Announcement', ['gamemaster', 'player', 'screen'], FULL, {
    player: PlayerAnnouncementWidget,
    screen: ScreenAnnouncementWidget,
  }),
  image: widget(
    'image',
    'Image',
    ['gamemaster', 'player', 'screen', 'scoreboard'],
    HALF,
    { gamemaster: ImageWidget, player: ImageWidget, screen: ImageWidget, scoreboard: ImageWidget },
    ImageConfigSchema
  ),
  game_controls: widget('game_controls', 'Game controls', ['gamemaster'], FULL, {
    gamemaster: GamemasterGameControlsWidget,
  }),
  // Players and screens get no navigation data, so only the game master can show progress
  progress: widget('progress', 'Progress', ['gamemaster'], FULL, {
    gamemaster: GamemasterProgressWidget,
  }),
  game_log: widget('game_log', 'Game log', ['gamemaster', 'screen', 'scoreboard'], HALF, {
    gamemaster: GamemasterLogWidget,
    screen: ScreenLogWidget,
  }),
}
