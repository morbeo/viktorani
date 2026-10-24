import { z } from 'zod'
import type { LayoutTarget, WidgetType } from '@/db'
import { GRID_COLUMNS, type GridSize } from '@/lib/layout-grid'
import { ImageConfigSchema, TextConfigSchema } from './content-config'
import { LeaderboardConfigSchema } from './leaderboard'

/**
 * What a widget type is, without how it renders: its label, surfaces, size and settings.
 * `registry.tsx` adds the React components; this module stays free of React so the MCP
 * tools (ADR 0021) can check layouts in Node.
 */
export interface WidgetSpec<TConfig = Record<string, unknown>> {
  type: WidgetType
  label: string
  allowedTargets: readonly LayoutTarget[]
  /** Size a newly placed widget gets on the 12-column grid. */
  preferredSize: GridSize
  configSchema: z.ZodType<TConfig>
  defaultConfig: TConfig
}

const FULL: GridSize = { w: GRID_COLUMNS, h: 1 }
const HALF: GridSize = { w: GRID_COLUMNS / 2, h: 1 }

const ALL: readonly LayoutTarget[] = ['gamemaster', 'player', 'screen', 'scoreboard']
const CONTENT: readonly LayoutTarget[] = ['gamemaster', 'player', 'screen']

/** One spec. The default config is what `configSchema` makes of `{}`, so every setting needs a default. */
function spec(
  type: WidgetType,
  label: string,
  allowedTargets: readonly LayoutTarget[],
  preferredSize: GridSize,
  configSchema: z.ZodType<Record<string, unknown>> = z.strictObject({})
): WidgetSpec {
  return {
    type,
    label,
    allowedTargets,
    preferredSize,
    configSchema,
    defaultConfig: configSchema.parse({}),
  }
}

/** Every {@link WidgetType}'s spec. */
export const WIDGET_SPECS: Record<WidgetType, WidgetSpec> = {
  buzzer: spec('buzzer', 'Buzzer', ['gamemaster', 'player'], HALF),
  question: spec('question', 'Question', CONTENT, FULL),
  answers: spec('answers', 'Answers', CONTENT, FULL),
  media: spec('media', 'Media', CONTENT, FULL),
  timer: spec('timer', 'Timer', CONTENT, HALF),
  buzz_order: spec('buzz_order', 'Buzz order', ['gamemaster'], HALF),
  scoreboard: spec('scoreboard', 'Scoreboard', ['gamemaster', 'screen'], HALF),
  leaderboard: spec(
    'leaderboard',
    'Leaderboard',
    ['screen', 'scoreboard'],
    HALF,
    LeaderboardConfigSchema
  ),
  player_list: spec('player_list', 'Player list', ['gamemaster'], HALF),
  round_info: spec('round_info', 'Round info', ['gamemaster', 'screen'], FULL),
  text: spec('text', 'Text', ALL, HALF, TextConfigSchema),
  qr_code: spec('qr_code', 'QR code', ['gamemaster'], HALF),
  announcement: spec('announcement', 'Announcement', CONTENT, FULL),
  image: spec('image', 'Image', ALL, HALF, ImageConfigSchema),
  game_controls: spec('game_controls', 'Game controls', ['gamemaster'], FULL),
  // Players and screens get no navigation data, so only the game master can show progress
  progress: spec('progress', 'Progress', ['gamemaster'], FULL),
  game_log: spec('game_log', 'Game log', ['gamemaster', 'screen', 'scoreboard'], HALF),
}
