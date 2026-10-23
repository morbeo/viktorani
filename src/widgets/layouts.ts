import { GAME_PHASES } from '@/db'
import type { GamePhase, Layout, LayoutAssignments, LayoutTarget, Widget, WidgetType } from '@/db'
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
 * Each reproduces the fixed view it replaced. The screen's is the projector view: the host's
 * message, the heading, the question, its media and answers, then timers, scores and the
 * log. The game master's is the play column: where the game is, the question, the buzzer
 * and the timers (the controls, navigation and side panel stay fixed around it). The
 * player's is the phone view: the host's message, the question, the buzz button and the
 * timers. Once the game has ended, the question (screen) and the buzzer and timers go. The
 * scoreboard's is the leaderboard.
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
  stacked('player', null, ['announcement', 'question', 'buzzer', 'timer']),
  stacked('player', 'ended', ['announcement']),
  stacked('gamemaster', null, ['round_info', 'question', 'buzzer', 'timer']),
  stacked('gamemaster', 'ended', ['round_info', 'question']),
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
 * The layout the host chose for `phase` in `assignments` (or for all phases, when it chose
 * none for this one), if it is in `candidates`, fits the target and game, and can render.
 */
function assigned(
  candidates: readonly LayoutBundle[],
  target: LayoutTarget,
  gameId: string | null,
  phase: GamePhase | null,
  assignments: LayoutAssignments | undefined
): LayoutBundle | null {
  const id = (phase && assignments?.[phase]) || assignments?.all
  if (!id) return null
  const bundle = candidates.find(b => b.layout.id === id)
  if (!bundle) return null
  const { layout } = bundle
  const fits = layout.gameId === null || layout.gameId === gameId
  return fits && isRenderable(bundle, target) ? bundle : null
}

/**
 * The layout a surface shows.
 *
 * @remarks
 * The layout the host chose for this game, surface and phase in `assignments` comes first
 * (#415), then its choice for all phases; a built-in default can be chosen too. Without a
 * usable choice, picks from `stored` the best renderable layout for `target` that belongs to
 * `gameId` or is a global template (`gameId: null`), and is for `phase` or for all phases.
 * This game's own layouts beat templates, an exact phase beats an all-phase layout, then the
 * active one and the lowest `order` win. A layout that fails {@link isRenderable} is
 * skipped. With nothing left, the built-in default for the target and phase is used.
 */
export function resolveLayout(
  stored: readonly LayoutBundle[],
  {
    target,
    gameId,
    phase,
    assignments,
  }: {
    target: LayoutTarget
    gameId: string | null
    phase: GamePhase | null
    assignments?: LayoutAssignments
  }
): LayoutBundle {
  const chosen =
    assigned([...stored, ...BUILTIN_LAYOUTS], target, gameId, phase, assignments) ??
    pick(stored, target, gameId, phase) ??
    pick(BUILTIN_LAYOUTS, target, null, phase)
  if (!chosen) throw new Error(`No built-in layout for ${target}`)
  return chosen
}

/**
 * The stored layouts a remote surface needs to pick its layout itself: for each phase (and
 * for no phase), the one {@link resolveLayout} would pick from `stored` with `assignments`,
 * without duplicates.
 *
 * @remarks
 * Resolving among just these, with the same `assignments`, gives the same layout for every
 * phase as resolving among all of `stored`: each phase's pick is in the set, and a chosen
 * layout outranks the rest. So the host can send them once and the surface switches with
 * the phase on its own. Built-in layouts are left out, since the surface has them already;
 * empty when only those are used.
 */
export function layoutsForPhases(
  stored: readonly LayoutBundle[],
  target: LayoutTarget,
  gameId: string,
  assignments?: LayoutAssignments
): LayoutBundle[] {
  const picked = new Map<string, LayoutBundle>()
  for (const phase of [null, ...GAME_PHASES]) {
    const bundle =
      assigned(stored, target, gameId, phase, assignments) ?? pick(stored, target, gameId, phase)
    if (bundle) picked.set(bundle.layout.id, bundle)
  }
  return [...picked.values()]
}
