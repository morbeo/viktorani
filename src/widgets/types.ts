import type { ComponentType, ReactNode } from 'react'
import type { z } from 'zod'
import type { LayoutTarget, WidgetType } from '@/db'
import type { GameEvent, LogEntry, ScoreboardRow } from '@/transport/types'
import type { GridSize } from '@/lib/layout-grid'

/** Surfaces a widget can be placed on: the same set as `Layout.target`. */
export type WidgetTarget = LayoutTarget

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
  /** Size a newly placed widget gets on the 12-column grid. */
  preferredSize: GridSize
  configSchema: z.ZodType<TConfig>
  defaultConfig: TConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: Partial<Record<WidgetTarget, ComponentType<any>>>
}

/** What a projector screen knows about the game, as handed to its widgets. */
export interface ScreenData {
  /** Shown above the question, e.g. the round and question number, "Paused" or "Game over". */
  heading: string | null
  /** The current question, as far as the `screen` visibility allows. */
  content: Extract<GameEvent, { type: 'QUESTION_CONTENT' }> | null
  /** The host's message to the screens. */
  message: string | null
  /** Ranked names and scores; empty when scoring is off. */
  rows: ScoreboardRow[]
  /** Recent public game events, newest first. */
  logEntries: LogEntry[]
  /**
   * The surface's timers, already rendered: the host's projector window reads them from the
   * database and a remote screen from the transport, so each surface supplies its own.
   */
  timers: ReactNode
}

/** Live data per surface. Only the screen is rendered from a layout so far. */
export interface SurfaceData {
  gamemaster: never
  player: never
  screen: ScreenData
  scoreboard: never
}

/** Props the `LayoutRenderer` gives every widget component. */
export interface WidgetProps<TData = unknown, TConfig = unknown> {
  data: TData
  config: TConfig
}
