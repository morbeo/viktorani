import { z } from 'zod'
import type { ComponentType } from 'react'
import type { WidgetType } from '@/db'
import { WidgetPlaceholder } from './placeholder'
import type { WidgetDefinition, WidgetTarget } from './types'

function placeholderFor(label: string): ComponentType<{ config: Record<string, never> }> {
  function Placeholder() {
    return <WidgetPlaceholder label={label} />
  }
  Placeholder.displayName = `${label}Placeholder`
  return Placeholder
}

/**
 * One registry entry, with a config-less placeholder for every allowed target. Real
 * per-target components (several already exist, e.g. `BuzzerPanel`, `TimerPanel`) are wired
 * in by #410's `LayoutRenderer`, once it can supply the live game data they need.
 */
function widget(
  type: WidgetType,
  label: string,
  allowedTargets: readonly WidgetTarget[],
  preferredWidth: 'full' | 'half'
): WidgetDefinition {
  const Placeholder = placeholderFor(label)
  const components: WidgetDefinition['components'] = {}
  for (const target of allowedTargets) components[target] = Placeholder
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

/** Every {@link WidgetType}, with its metadata and a placeholder component per target. */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  buzzer: widget('buzzer', 'Buzzer', ['admin', 'player'], 'half'),
  question: widget('question', 'Question', ['admin', 'player', 'screen'], 'full'),
  answers: widget('answers', 'Answers', ['admin', 'player', 'screen'], 'full'),
  media: widget('media', 'Media', ['admin', 'player', 'screen'], 'full'),
  timer: widget('timer', 'Timer', ['admin', 'player', 'screen'], 'half'),
  buzz_order: widget('buzz_order', 'Buzz order', ['admin'], 'half'),
  scoreboard: widget('scoreboard', 'Scoreboard', ['admin', 'screen'], 'half'),
  leaderboard: widget('leaderboard', 'Leaderboard', ['screen', 'scoreboard'], 'half'),
  player_list: widget('player_list', 'Player list', ['admin'], 'half'),
  round_info: widget('round_info', 'Round info', ['admin'], 'full'),
  text: widget('text', 'Text', ['admin', 'player', 'screen', 'scoreboard'], 'half'),
  qr_code: widget('qr_code', 'QR code', ['admin'], 'half'),
  announcement: widget('announcement', 'Announcement', ['admin', 'player', 'screen'], 'full'),
  image: widget('image', 'Image', ['admin', 'player', 'screen', 'scoreboard'], 'half'),
  game_controls: widget('game_controls', 'Game controls', ['admin'], 'full'),
  progress: widget('progress', 'Progress', ['admin', 'player', 'screen'], 'full'),
}
