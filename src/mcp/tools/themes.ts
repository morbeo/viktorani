import { z } from 'zod'
import { db, FONT_KEYS, ICON_STROKES } from '@/db'
import type { Theme } from '@/db'
import { duplicateTheme, saveTheme } from '@/db/themes'
import { LogoSchema, ThemePaletteSchema } from '@/db/snapshot-schema'
import { BUILT_IN_THEMES, DEFAULT_THEME_ID, findTheme } from '@/lib/theme'
import { IdInput, ToolError, defineTool, definedOnly, formatIssues, notFound } from '../tool'

const PalettePatch = ThemePaletteSchema.partial().describe(
  'Colours to change (#rrggbb): bg, surface, text, muted, border, accent, accentSubtle, ' +
    'onAccent (null picks black or white), positive, negative'
)

const ThemePatch = {
  name: z.string().trim().min(1).max(60).optional(),
  light: PalettePatch.optional(),
  dark: PalettePatch.nullable()
    .optional()
    .describe('Dark palette changes, or null for a light-only theme'),
  fonts: z
    .object({
      display: z.enum(FONT_KEYS).optional(),
      body: z.enum(FONT_KEYS).optional(),
      mono: z.enum(FONT_KEYS).optional(),
    })
    .optional()
    .describe(`Fonts by key: ${FONT_KEYS.join(', ')}`),
  iconStroke: z.literal(ICON_STROKES).optional(),
  logo: z
    .object({ wordmark: LogoSchema.nullable().optional(), mark: LogoSchema.nullable().optional() })
    .optional()
    .describe('https URLs (or data:image/ URLs) of the wide wordmark and the square mark'),
}

/** `theme` with `patch` merged in, field by field. */
function merge(theme: Theme, patch: z.output<z.ZodObject<typeof ThemePatch>>): Theme {
  const base = BUILT_IN_THEMES.find(t => t.id === DEFAULT_THEME_ID)!
  return {
    ...theme,
    ...definedOnly({ name: patch.name, iconStroke: patch.iconStroke }),
    light: { ...theme.light, ...definedOnly(patch.light ?? {}) },
    dark:
      patch.dark === null
        ? null
        : patch.dark
          ? { ...(theme.dark ?? base.dark ?? theme.light), ...definedOnly(patch.dark) }
          : theme.dark,
    fonts: { ...theme.fonts, ...definedOnly(patch.fonts ?? {}) },
    logo: { ...theme.logo, ...definedOnly(patch.logo ?? {}) },
  }
}

/** Validate and store `theme`, turning schema errors into a message the assistant can act on. */
async function store(theme: Theme): Promise<Theme> {
  try {
    await saveTheme(theme)
  } catch (e) {
    throw new ToolError(
      e instanceof z.ZodError ? `Invalid theme: ${formatIssues(e)}` : (e as Error).message
    )
  }
  return theme
}

const listThemes = defineTool({
  name: 'list_themes',
  title: 'List themes',
  description: 'The built-in themes (read-only) and the host’s own, with the games using each.',
  kind: 'read',
  input: z.object({}),
  async run() {
    const [own, games] = await Promise.all([db.themes.toArray(), db.games.toArray()])
    const row = (t: Theme, builtin: boolean) => ({
      id: t.id,
      name: t.name,
      builtin,
      games: games.filter(g => g.themeId === t.id).map(g => g.name),
    })
    return [...BUILT_IN_THEMES.map(t => row(t, true)), ...own.map(t => row(t, false))]
  },
})

const getTheme = defineTool({
  name: 'get_theme',
  title: 'Get theme',
  description: 'One theme in full: palettes, fonts, icon stroke and logos.',
  kind: 'read',
  input: IdInput,
  async run({ id }) {
    const theme = BUILT_IN_THEMES.find(t => t.id === id) ?? (await db.themes.get(id))
    return theme ?? notFound('theme', id)
  },
})

const createTheme = defineTool({
  name: 'create_theme',
  title: 'Create theme',
  description:
    'Add a theme as a copy of another (Classic by default) with any changes applied. ' +
    'Give it to a game with update_game themeId.',
  kind: 'write',
  input: z.object({
    from: z.string().default(DEFAULT_THEME_ID).describe('Theme id to start from'),
    ...ThemePatch,
    name: z.string().trim().min(1).max(60),
  }),
  async run({ from, ...patch }) {
    const own = await db.themes.toArray()
    const source = findTheme(from, own)
    if (source.id !== from) notFound('theme', from)
    return store(merge(duplicateTheme(source, patch.name), patch))
  },
})

const updateTheme = defineTool({
  name: 'update_theme',
  title: 'Update theme',
  description: 'Change any part of one of the host’s themes; built-in themes are read-only.',
  kind: 'write',
  input: IdInput.extend(ThemePatch),
  async run({ id, ...patch }) {
    if (BUILT_IN_THEMES.some(t => t.id === id)) {
      throw new ToolError('Built-in themes are read-only; copy one with create_theme')
    }
    const theme = (await db.themes.get(id)) ?? notFound('theme', id)
    return store(merge(theme, patch))
  },
})

const deleteTheme = defineTool({
  name: 'delete_theme',
  title: 'Delete theme',
  description:
    'Delete one of the host’s themes. Games using it go back to the app theme, and if it ' +
    'was the app theme, the app goes back to Classic.',
  kind: 'delete',
  input: IdInput,
  async run({ id }, ctx) {
    if (!(await db.themes.get(id))) notFound('theme', id)
    // Same as db/themes deleteTheme, with the backup's settings in place of this device's
    await db.transaction('rw', db.themes, db.games, async () => {
      await db.themes.delete(id)
      await db.games.filter(g => g.themeId === id).modify({ themeId: null })
    })
    const settings = ctx.session.settings
    if (settings?.themeId === id) ctx.session.settings = { ...settings, themeId: DEFAULT_THEME_ID }
    return { deleted: id }
  },
})

export const THEME_TOOLS = [listThemes, getTheme, createTheme, updateTheme, deleteTheme]
