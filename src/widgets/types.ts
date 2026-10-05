import type { ComponentType } from 'react'
import type { z } from 'zod'
import type { WidgetType } from '@/db'

/**
 * Surfaces a widget can be placed on. `screen` and `scoreboard` aren't real `Layout.target`
 * values yet (that db type only has `'admin' | 'player'`) — extending it is #409's job.
 */
export type WidgetTarget = 'admin' | 'player' | 'screen' | 'scoreboard'

/**
 * Everything the registry knows about one {@link WidgetType}.
 *
 * @remarks
 * `components` has one entry per target the widget actually renders on today; a target
 * listed in `allowedTargets` without a matching component isn't implemented yet. Some are
 * real extracted components (e.g. `QrCodePanel`, `ScreenQuestion`) with their own natural
 * props; most are still `WidgetPlaceholder`s, since the rest need live game data (players,
 * buzzes, the current question, ...) that only #410's `LayoutRenderer` will supply. Props
 * are intentionally untyped here (`ComponentType<any>`) rather than forced into a uniform
 * `config`-only shape — unifying how data reaches each widget is #410's problem, not this
 * registry's.
 */
export interface WidgetDefinition<TConfig = Record<string, never>> {
  type: WidgetType
  label: string
  allowedTargets: readonly WidgetTarget[]
  preferredWidth: 'full' | 'half'
  configSchema: z.ZodType<TConfig>
  defaultConfig: TConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: Partial<Record<WidgetTarget, ComponentType<any>>>
}
