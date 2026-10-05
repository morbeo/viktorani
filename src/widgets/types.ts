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
 * listed in `allowedTargets` without a matching component isn't implemented yet.
 * Every component takes `config` alone — wiring in live game data (players, buzzes, the
 * current question, ...) is #410's `LayoutRenderer`, not this registry.
 */
export interface WidgetDefinition<TConfig = Record<string, never>> {
  type: WidgetType
  label: string
  allowedTargets: readonly WidgetTarget[]
  preferredWidth: 'full' | 'half'
  configSchema: z.ZodType<TConfig>
  defaultConfig: TConfig
  components: Partial<Record<WidgetTarget, ComponentType<{ config: TConfig }>>>
}
