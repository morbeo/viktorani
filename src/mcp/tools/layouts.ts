import { z } from 'zod'
import { db, GAME_PHASES, LAYOUT_SLOTS, LAYOUT_TARGETS, WIDGET_TYPES } from '@/db'
import type { GridRect, Layout, Widget } from '@/db'
import { setLayoutAssignment } from '@/db/games'
import {
  addWidget,
  copyLayout,
  createLayout,
  deleteLayout,
  deleteWidget,
  loadLayoutBundle,
  updateLayout,
  updateWidget,
} from '@/db/layout-editor'
import { GridRectSchema, LayoutThemeSchema } from '@/db/snapshot-schema'
import { clampRect } from '@/lib/layout-designer'
import { BUILTIN_LAYOUTS } from '@/widgets/layouts'
import type { LayoutBundle } from '@/widgets/layouts'
import { WIDGET_SPECS } from '@/widgets/specs'
import { IdInput, ToolError, defineTool, definedOnly, notFound } from '../tool'

const Target = z.enum(LAYOUT_TARGETS).describe('gamemaster, player, screen or scoreboard')
const Phase = z
  .enum(GAME_PHASES)
  .nullable()
  .describe('lobby, question, buzzed, reveal, scoreboard or ended; null for every phase')
const Grid = GridRectSchema.describe('Cells on the 12-column grid: x, y, w, h')

/** A stored or built-in layout with its widgets. */
async function bundle(id: string): Promise<LayoutBundle> {
  const builtin = BUILTIN_LAYOUTS.find(b => b.layout.id === id)
  return builtin ?? (await loadLayoutBundle(id)) ?? notFound('layout', id)
}

/** Throw if `id` is a built-in layout, which lives in code and can't change. */
function refuseBuiltin(id: string) {
  if (BUILTIN_LAYOUTS.some(b => b.layout.id === id)) {
    throw new ToolError('Built-in layouts are read-only; copy one with create_layout first')
  }
}

/** `config` merged over the type's defaults and checked against its schema. */
function checkConfig(type: Widget['type'], config: Record<string, unknown>) {
  const spec = WIDGET_SPECS[type]
  const parsed = spec.configSchema.safeParse({ ...spec.defaultConfig, ...config })
  if (!parsed.success) {
    throw new ToolError(`Invalid ${type} settings: ${parsed.error.issues[0].message}`)
  }
  return parsed.data
}

/** Throw unless `type` may be placed on the layout's target. */
function checkTarget(layout: Layout, type: Widget['type']) {
  if (!WIDGET_SPECS[type].allowedTargets.includes(layout.target)) {
    throw new ToolError(
      `${type} can't go on a ${layout.target} layout; see list_widget_types for where it can`
    )
  }
}

const listWidgetTypes = defineTool({
  name: 'list_widget_types',
  title: 'List widget types',
  description:
    'Every widget type: where it can go, the size it gets by default and its settings as ' +
    'JSON Schema (most have none).',
  kind: 'read',
  input: z.object({}),
  async run() {
    return WIDGET_TYPES.map(type => {
      const spec = WIDGET_SPECS[type]
      return {
        type,
        label: spec.label,
        targets: spec.allowedTargets,
        defaultSize: spec.preferredSize,
        settings: z.toJSONSchema(spec.configSchema, { io: 'input' }),
      }
    })
  },
})

const listLayouts = defineTool({
  name: 'list_layouts',
  title: 'List layouts',
  description:
    'Layouts of one game, or the templates (gameId null), plus the built-in defaults every ' +
    'surface falls back to.',
  kind: 'read',
  input: z.object({
    gameId: z.string().nullable().default(null).describe('A game id, or null for templates'),
  }),
  async run({ gameId }) {
    const [layouts, widgets] = await Promise.all([db.layouts.toArray(), db.widgets.toArray()])
    const row = (l: Layout, count: number, builtin: boolean) => ({
      id: l.id,
      name: l.name,
      target: l.target,
      phase: l.phase,
      isActive: l.isActive,
      widgets: count,
      builtin,
    })
    return [
      ...layouts
        .filter(l => l.gameId === gameId)
        .sort((a, b) => a.order - b.order)
        .map(l => row(l, widgets.filter(w => w.layoutId === l.id).length, false)),
      ...BUILTIN_LAYOUTS.map(b => row(b.layout, b.widgets.length, true)),
    ]
  },
})

const getLayout = defineTool({
  name: 'get_layout',
  title: 'Get layout',
  description: 'One layout, stored or built in, with its widgets in reading order.',
  kind: 'read',
  input: IdInput,
  async run({ id }) {
    const { layout, widgets } = await bundle(id)
    return { ...layout, widgets: [...widgets].sort((a, b) => a.order - b.order) }
  },
})

const createLayoutTool = defineTool({
  name: 'create_layout',
  title: 'Create layout',
  description:
    'Add a layout for a game, or a template when gameId is null. Starts empty, or as a copy ' +
    'of another layout (a built-in default, a template or another game’s).',
  kind: 'write',
  input: z.object({
    name: z.string().trim().min(1).max(60),
    gameId: z.string().nullable().default(null),
    target: Target.optional().describe('Needed unless copying'),
    phase: Phase.default(null),
    from: z.string().optional().describe('Layout id to copy, widgets included'),
  }),
  async run({ name, gameId, target, phase, from }) {
    if (gameId && !(await db.games.get(gameId))) notFound('game', gameId)
    if (from) {
      const source = await bundle(from)
      if (target && target !== source.layout.target) {
        throw new ToolError(`A copy keeps the source's target (${source.layout.target})`)
      }
      return copyLayout(source, { gameId, name, phase })
    }
    if (!target) throw new ToolError('Give a target, or a layout to copy from')
    return createLayout({ gameId, target, phase, name })
  },
})

const updateLayoutTool = defineTool({
  name: 'update_layout',
  title: 'Update layout',
  description:
    'Rename a layout, change its phase or active flag, or its look: background and accent ' +
    '(#rrggbb or null to inherit), fontScale (0.5 to 2) and logo (https URL or null).',
  kind: 'write',
  input: IdInput.extend({
    name: z.string().trim().min(1).max(60).optional(),
    phase: Phase.optional(),
    isActive: z.boolean().optional(),
    theme: LayoutThemeSchema.partial().optional(),
  }),
  async run({ id, theme, ...patch }) {
    refuseBuiltin(id)
    const layout = (await db.layouts.get(id)) ?? notFound('layout', id)
    const next = definedOnly({
      ...patch,
      theme: theme && { ...layout.theme, ...definedOnly(theme) },
    })
    await updateLayout(id, next)
    return { ...layout, ...next }
  },
})

const deleteLayoutTool = defineTool({
  name: 'delete_layout',
  title: 'Delete layout',
  description: 'Delete a layout and its widgets.',
  kind: 'delete',
  input: IdInput,
  async run({ id }) {
    refuseBuiltin(id)
    if (!(await db.layouts.get(id))) notFound('layout', id)
    await deleteLayout(id)
    return { deleted: id }
  },
})

const addWidgetTool = defineTool({
  name: 'add_widget',
  title: 'Add widget',
  description:
    'Place a widget on a layout. Without a grid it gets its type’s default size, below ' +
    'the others. Settings are checked against the type (see list_widget_types).',
  kind: 'write',
  input: z.object({
    layoutId: z.string().min(1),
    type: z.enum(WIDGET_TYPES),
    grid: Grid.optional(),
    config: z.record(z.string(), z.unknown()).default({}),
  }),
  async run({ layoutId, type, grid, config }) {
    refuseBuiltin(layoutId)
    const layout = (await db.layouts.get(layoutId)) ?? notFound('layout', layoutId)
    checkTarget(layout, type)
    const siblings = await db.widgets.where('layoutId').equals(layoutId).toArray()
    const below = siblings.reduce((max, w) => Math.max(max, w.grid.y + w.grid.h), 0)
    const place: GridRect =
      grid ?? clampRect({ x: 0, y: below, ...WIDGET_SPECS[type].preferredSize })
    return addWidget({ layoutId, type, grid: place, config: checkConfig(type, config) })
  },
})

const updateWidgetTool = defineTool({
  name: 'update_widget',
  title: 'Update widget',
  description:
    'Move or resize a widget, set its phone or TV placement (null clears it), or change ' +
    'its settings (merged into the current ones).',
  kind: 'write',
  input: IdInput.extend({
    grid: Grid.optional(),
    phone: Grid.nullable().optional(),
    tv: Grid.nullable().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  }),
  async run({ id, grid, phone, tv, config }) {
    const widget = (await db.widgets.get(id)) ?? notFound('widget', id)
    const breakpoints = { ...widget.breakpoints }
    if (phone !== undefined) {
      if (phone) breakpoints.phone = phone
      else delete breakpoints.phone
    }
    if (tv !== undefined) {
      if (tv) breakpoints.tv = tv
      else delete breakpoints.tv
    }
    const patch = {
      grid: grid ?? widget.grid,
      breakpoints,
      config: config ? checkConfig(widget.type, { ...widget.config, ...config }) : widget.config,
    }
    await updateWidget(id, patch)
    return { ...widget, ...patch }
  },
})

const removeWidget = defineTool({
  name: 'remove_widget',
  title: 'Remove widget',
  description: 'Take a widget off its layout.',
  kind: 'delete',
  input: IdInput,
  async run({ id }) {
    if (!(await db.widgets.get(id))) notFound('widget', id)
    await deleteWidget(id)
    return { deleted: id }
  },
})

const assignLayout = defineTool({
  name: 'assign_layout',
  title: 'Assign layout',
  description:
    'Choose which layout a game shows on a surface, for one phase or "all"; layoutId null ' +
    'clears the choice so the automatic pick applies.',
  kind: 'write',
  input: z.object({
    gameId: z.string().min(1),
    target: Target,
    slot: z.enum(LAYOUT_SLOTS as [string, ...string[]]).describe('"all" or a phase'),
    layoutId: z.string().nullable(),
  }),
  async run({ gameId, target, slot, layoutId }) {
    const game = (await db.games.get(gameId)) ?? notFound('game', gameId)
    if (layoutId) {
      const { layout } = await bundle(layoutId)
      if (layout.target !== target) {
        throw new ToolError(`Layout "${layout.name}" is for ${layout.target}, not ${target}`)
      }
      if (layout.gameId !== null && layout.gameId !== gameId) {
        throw new ToolError(`Layout "${layout.name}" belongs to another game`)
      }
    }
    const patch = await setLayoutAssignment(
      game,
      target,
      slot as (typeof LAYOUT_SLOTS)[number],
      layoutId
    )
    return { gameId, layoutAssignments: patch.layoutAssignments }
  },
})

export const LAYOUT_TOOLS = [
  listWidgetTypes,
  listLayouts,
  getLayout,
  createLayoutTool,
  updateLayoutTool,
  deleteLayoutTool,
  addWidgetTool,
  updateWidgetTool,
  removeWidget,
  assignLayout,
]
