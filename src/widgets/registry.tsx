import type { ComponentType } from 'react'
import type { WidgetType } from '@/db'
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
  ScreenLeaderboardWidget,
  ScreenLogWidget,
  ScreenMediaWidget,
  ScreenQuestionWidget,
  ScreenScoresWidget,
  ScreenTimersWidget,
} from '@/components/screen/screen-widgets'
import {
  ScoreboardLeaderboardWidget,
  ScoreboardLogWidget,
} from '@/components/scoreboard/scoreboard-widgets'
import { ImageWidget, TextWidget } from './content-widgets'
import { WidgetPlaceholder } from './placeholder'
import { WIDGET_SPECS } from './specs'
import type { WidgetDefinition, WidgetTarget } from './types'

function placeholderFor(label: string): ComponentType {
  function Placeholder() {
    return <WidgetPlaceholder label={label} />
  }
  Placeholder.displayName = `${label}Placeholder`
  return Placeholder
}

/**
 * One registry entry: the type's {@link WIDGET_SPECS} entry plus a component per allowed
 * target. Targets in `overrides` get their real widget adapter; the rest get a placeholder.
 */
function widget(
  type: WidgetType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides: Partial<Record<WidgetTarget, ComponentType<any>>> = {}
): WidgetDefinition {
  const spec = WIDGET_SPECS[type]
  const Placeholder = placeholderFor(spec.label)
  const components: WidgetDefinition['components'] = {}
  for (const target of spec.allowedTargets) components[target] = overrides[target] ?? Placeholder
  return { ...spec, components }
}

/** Every {@link WidgetType}, with its metadata and a component (real or placeholder) per target. */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  buzzer: widget('buzzer', {
    gamemaster: GamemasterBuzzerWidget,
    player: PlayerBuzzerWidget,
  }),
  question: widget('question', {
    gamemaster: GamemasterQuestionWidget,
    player: PlayerQuestionWidget,
    screen: ScreenQuestionWidget,
  }),
  answers: widget('answers', {
    screen: ScreenAnswersWidget,
  }),
  media: widget('media', {
    screen: ScreenMediaWidget,
  }),
  timer: widget('timer', {
    gamemaster: GamemasterTimerWidget,
    player: PlayerTimerWidget,
    screen: ScreenTimersWidget,
  }),
  buzz_order: widget('buzz_order', {
    gamemaster: GamemasterBuzzOrderWidget,
  }),
  scoreboard: widget('scoreboard', {
    gamemaster: GamemasterScoreboardWidget,
    screen: ScreenScoresWidget,
  }),
  leaderboard: widget('leaderboard', {
    screen: ScreenLeaderboardWidget,
    scoreboard: ScoreboardLeaderboardWidget,
  }),
  player_list: widget('player_list', {
    gamemaster: GamemasterPlayerListWidget,
  }),
  round_info: widget('round_info', {
    gamemaster: GamemasterRoundInfoWidget,
    screen: ScreenHeadingWidget,
  }),
  text: widget('text', {
    gamemaster: TextWidget,
    player: TextWidget,
    screen: TextWidget,
    scoreboard: TextWidget,
  }),
  qr_code: widget('qr_code', {
    gamemaster: GamemasterQrCodeWidget,
  }),
  announcement: widget('announcement', {
    player: PlayerAnnouncementWidget,
    screen: ScreenAnnouncementWidget,
  }),
  image: widget('image', {
    gamemaster: ImageWidget,
    player: ImageWidget,
    screen: ImageWidget,
    scoreboard: ImageWidget,
  }),
  game_controls: widget('game_controls', {
    gamemaster: GamemasterGameControlsWidget,
  }),
  // Players and screens get no navigation data, so only the game master can show progress
  progress: widget('progress', {
    gamemaster: GamemasterProgressWidget,
  }),
  game_log: widget('game_log', {
    gamemaster: GamemasterLogWidget,
    screen: ScreenLogWidget,
    scoreboard: ScoreboardLogWidget,
  }),
}
