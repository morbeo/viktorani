import type { GamePhase, Layout, LayoutTarget, Widget, WidgetType } from '@/db'
import { LayoutSchema, WidgetSchema } from '@/db/snapshot-schema'
import { DEFAULT_LAYOUT_THEME, GRID_COLUMNS } from '@/lib/layout-grid'
import { WIDGET_REGISTRY } from './registry'

/** A layout together with its widgets, as stored or as built in. */
export interface LayoutBundle {
  layout: Layout
  widgets: Widget[]
}

/** Prefix of every built-in layout's id, so they can't clash with stored ones. */
export const BUILTIN_LAYOUT_PREFIX = 'builtin:'

/**
 * A built-in layout: `types` stacked top to bottom, each a full-width row, in that order.
 * Matches how the fixed views showed them before layouts existed.
 */
function stacked(target: LayoutTarget, phase: GamePhase | null, types: WidgetType[]): LayoutBundle {
  const id = `${BUILTIN_LAYOUT_PREFIX}${target}:${phase ?? 'all'}`
  return {
    layout: {
      id,
      gameId: null,
      name: 'Default',
      target,
      phase,
      theme: { ...DEFAULT_LAYOUT_THEME },
      isActive: true,
      order: 0,
    },
    widgets: types.map((type, i) => ({
      id: `${id}:${type}`,
      layoutId: id,
      type,
      config: WIDGET_REGISTRY[type].defaultConfig,
      grid: { x: 0, y: i, w: GRID_COLUMNS, h: 1 },
      breakpoints: {},
      order: i,
    })),
  }
}

/**
 * The layouts every surface falls back to when it has no valid layout of its own.
 *
 * @remarks
 * The screen's are today's projector view: the host's message, the heading, the question,
 * its media and answers, then timers, scores and the log; once the game has ended, the
 * timers and question go. The game master, player and scoreboard defaults list the same
 * pieces their fixed views show, for the designer (#412) to start from; those surfaces
 * don't render through `LayoutRenderer` yet, since most of their widgets are still
 * placeholders.
 */
export const BUILTIN_LAYOUTS: readonly LayoutBundle[] = [
  stacked('screen', null, [
    'announcement',
    'round_info',
    'question',
    'media',
    'answers',
    'timer',
    'scoreboard',
    'game_log',
  ]),
  stacked('screen', 'ended', ['announcement', 'round_info', 'scoreboard', 'game_log']),
  stacked('player', null, ['announcement', 'question', 'media', 'answers', 'timer', 'buzzer']),
  stacked('gamemaster', null, [
    'round_info',
    'progress',
    'question',
    'answers',
    'media',
    'game_controls',
    'buzzer',
    'buzz_order',
    'timer',
    'scoreboard',
    'player_list',
    'game_log',
  ]),
  stacked('scoreboard', null, ['leaderboard']),
]

/**
 * Whether `bundle` can be rendered on `target`: the layout and every widget pass the
 * stored-data schemas, each widget belongs to the layout, its type is allowed on the
 * target and its config matches the type's schema.
 */
export function isRenderable(bundle: LayoutBundle, target: LayoutTarget): boolean {
  const { layout, widgets } = bundle
  if (!LayoutSchema.safeParse(layout).success || layout.target !== target) return false
  return widgets.every(w => {
    if (!WidgetSchema.safeParse(w).success || w.layoutId !== layout.id) return false
    const def = WIDGET_REGISTRY[w.type]
    return def.allowedTargets.includes(target) && def.configSchema.safeParse(w.config).success
  })
}

/** Lower is better: this game's own layouts first, then the exact phase, then the active one. */
function rank(layout: Layout, gameId: string | null, phase: GamePhase | null): number[] {
  return [
    layout.gameId !== null && layout.gameId === gameId ? 0 : 1,
    layout.phase === phase ? 0 : 1,
    layout.isActive ? 0 : 1,
    layout.order,
  ]
}

function compareRanks(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

/** The best of `candidates` for the target, game and phase, or `null` when none fits. */
function pick(
  candidates: readonly LayoutBundle[],
  target: LayoutTarget,
  gameId: string | null,
  phase: GamePhase | null
): LayoutBundle | null {
  const fitting = candidates.filter(
    ({ layout }) =>
      layout.target === target &&
      (layout.gameId === null || layout.gameId === gameId) &&
      (layout.phase === null || layout.phase === phase)
  )
  const ranked = fitting
    .map(bundle => ({ bundle, rank: rank(bundle.layout, gameId, phase) }))
    .sort((a, b) => compareRanks(a.rank, b.rank))
  return ranked.find(({ bundle }) => isRenderable(bundle, target))?.bundle ?? null
}

/**
 * The layout a surface shows.
 *
 * @remarks
 * Picks from `stored` the best renderable layout for `target` that belongs to `gameId` or is
 * a global template (`gameId: null`), and is for `phase` or for all phases. This game's own
 * layouts beat templates, an exact phase beats an all-phase layout, then the active one and
 * the lowest `order` win. A layout that fails {@link isRenderable} is skipped. With nothing
 * left, the built-in default for the target and phase is used.
 */
export function resolveLayout(
  stored: readonly LayoutBundle[],
  {
    target,
    gameId,
    phase,
  }: { target: LayoutTarget; gameId: string | null; phase: GamePhase | null }
): LayoutBundle {
  const chosen = pick(stored, target, gameId, phase) ?? pick(BUILTIN_LAYOUTS, target, null, phase)
  if (!chosen) throw new Error(`No built-in layout for ${target}`)
  return chosen
}
