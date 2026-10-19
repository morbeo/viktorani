import { z } from 'zod'
import {
  FONT_KEYS,
  GAME_PHASES,
  ICON_STROKES,
  INPUT_TYPES,
  LAYOUT_TARGETS,
  REVEAL_TIMINGS,
  WIDGET_TYPES,
} from '@/db'
import type {
  DifficultyLevel,
  Tag,
  Question,
  Round,
  Game,
  GameQuestion,
  Note,
  GridRect,
  Layout,
  LayoutTheme,
  Theme,
  ThemePalette,
  Widget,
} from '@/db'
import { AppSettingsSchema, MAX_TIMER_SECONDS } from '@/lib/app-settings'
import { DEFAULT_LAYOUT_THEME, GRID_COLUMNS } from '@/lib/layout-grid'
import { BUILT_IN_THEME_IDS } from '@/lib/theme'
import {
  AUTO_ADVANCE_DEFAULT_DELAY,
  MAX_AUTO_ADVANCE_DELAY,
  MAX_LIMIT,
} from '@/components/game-settings/game-settings'

/**
 * Zod schemas for validating user-supplied JSON imports (backups and question files).
 *
 * @remarks
 * Record schemas use `satisfies z.ZodType<T>` so they fail to compile when the
 * corresponding interface in `@/db` gains a field the schema does not know about.
 * Unknown keys (e.g. legacy `categoryId`) are stripped on parse.
 */

const QUESTION_TYPES = ['multiple_choice', 'true_false', 'open_ended'] as const
const MediaTypeSchema = z.enum(['image', 'audio', 'video']).nullable()

export const DifficultyLevelSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number(),
  color: z.string(),
  order: z.number(),
}) satisfies z.ZodType<DifficultyLevel>

export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
}) satisfies z.ZodType<Tag>

export const QuestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(QUESTION_TYPES),
  options: z.array(z.string()),
  answer: z.string(),
  description: z.string().default(''),
  difficulty: z.string().nullable(),
  tags: z.array(z.string()),
  media: z.string().nullable().default(null),
  mediaType: MediaTypeSchema.default(null),
  createdAt: z.number(),
  updatedAt: z.number(),
}) satisfies z.ZodType<Question>

export const RoundSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  questionIds: z.array(z.string()),
  createdAt: z.number(),
}) satisfies z.ZodType<Round>

const TargetVisibilitySchema = z.object({
  showQuestion: z.boolean(),
  showAnswers: z.boolean(),
  showMedia: z.boolean(),
})

/** Layout ids chosen for one surface of a game, per phase or `all` (#415). */
export const LayoutAssignmentsSchema = z.partialRecord(z.enum(['all', ...GAME_PHASES]), z.string())

export const GameSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['waiting', 'active', 'paused', 'ended']),
    // Pre-#265 backups also carry `transportMode` ('auto' | 'peer' | 'gun') and `passphrase`;
    // PeerJS is now the only transport, so those keys are stripped on parse like any unknown key.
    roomId: z.string().nullable(),
    // Backups before #268 carry one set of flags; they become both targets' visibility.
    showQuestion: z.boolean().optional(),
    showAnswers: z.boolean().optional(),
    showMedia: z.boolean().optional(),
    visibility: z
      .object({ players: TargetVisibilitySchema, screen: TargetVisibilitySchema })
      .optional(),
    maxTeams: z.number().default(0),
    maxPerTeam: z.number().default(0),
    maxPlayers: z.number().default(0),
    allowIndividual: z.boolean().default(true),
    allowLateJoin: z.boolean().default(true),
    allowRejoin: z.boolean().default(true),
    rejoinWindowSeconds: z.number().int().min(0).max(MAX_LIMIT).default(0),
    autoRemoveAfterMinutes: z.number().int().min(0).max(MAX_LIMIT).default(0),
    requireApproval: z.boolean().default(false),
    allowPlayerTeams: z.boolean().default(true),
    roundIds: z.array(z.string()),
    currentRoundIdx: z.number(),
    currentQuestionIdx: z.number(),
    buzzerLocked: z.boolean(),
    scoringEnabled: z.boolean().default(true),
    // Buzzer config was added after v1 backups; defaults mirror the game wizard. Backups
    // from before ADR 0023 have `buzzerEnabled` instead of `inputType`.
    buzzerEnabled: z.boolean().optional(),
    inputType: z.enum(INPUT_TYPES).optional(),
    autoLockOnFirstCorrect: z.boolean().default(false),
    allowFalseStarts: z.boolean().default(false),
    buzzDeduplication: z.enum(['firstOnly', 'all']).default('firstOnly'),
    tiebreakerMode: z.literal('serverOrder').default('serverOrder'),
    confirmUnruledNavigation: z.boolean().default(false),
    autoAdvanceOnCorrect: z.boolean().default(false),
    autoAdvanceOnTimerExpiry: z.boolean().default(false),
    autoAdvanceDelaySeconds: z
      .number()
      .int()
      .min(1)
      .max(MAX_AUTO_ADVANCE_DELAY)
      .default(AUTO_ADVANCE_DEFAULT_DELAY),
    revealTiming: z.enum(REVEAL_TIMINGS).default('manual'),
    holdScores: z.boolean().default(false),
    scoresAnnouncedAt: z.number().int().min(0).nullable().default(null),
    autoStartTimerOnQuestionShow: z.boolean().default(false),
    defaultTimerDuration: z.number().int().min(1).max(MAX_TIMER_SECONDS).default(60),
    soundEffectsMuted: z.boolean().default(false),
    layoutAssignments: z.partialRecord(z.enum(LAYOUT_TARGETS), LayoutAssignmentsSchema).optional(),
    themeId: z.string().min(1).max(64).nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .transform(({ showQuestion, showAnswers, showMedia, visibility, buzzerEnabled, ...game }) => {
    const flags = {
      showQuestion: showQuestion ?? true,
      showAnswers: showAnswers ?? false,
      showMedia: showMedia ?? true,
    }
    return {
      ...game,
      inputType: game.inputType ?? (buzzerEnabled === false ? 'none' : 'buzzer'),
      visibility: visibility ?? { players: { ...flags }, screen: { ...flags } },
    }
  }) satisfies z.ZodType<Game>

export const GameQuestionSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  questionId: z.string(),
  roundId: z.string(),
  order: z.number(),
  status: z.enum(['pending', 'correct', 'incorrect', 'skipped']),
  revealed: z.boolean().default(false),
}) satisfies z.ZodType<GameQuestion>

export const NoteSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
}) satisfies z.ZodType<Note>

/** Bottom edge of the grid: a widget can't start or extend below this row. */
export const MAX_GRID_ROWS = 100

/** Longest logo URL (a `data:image/` URL inlines the image), about 1.5 MB of image. */
export const MAX_LOGO_LENGTH = 2_000_000

export const GridRectSchema = z
  .object({
    x: z
      .number()
      .int()
      .min(0)
      .max(GRID_COLUMNS - 1),
    y: z
      .number()
      .int()
      .min(0)
      .max(MAX_GRID_ROWS - 1),
    w: z.number().int().min(1).max(GRID_COLUMNS),
    h: z.number().int().min(1).max(MAX_GRID_ROWS),
  })
  .refine(r => r.x + r.w <= GRID_COLUMNS, { error: 'widget overflows the grid columns' })
  .refine(r => r.y + r.h <= MAX_GRID_ROWS, {
    error: 'widget overflows the grid rows',
  }) satisfies z.ZodType<GridRect>

export const HexColourSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, { error: 'expected a #rrggbb colour' })

/**
 * Whether `src` may be used as an image source in a layout: an inlined `data:image/` URL or
 * a remote `https://` one. Anything else (javascript:, http:, other data types) is refused.
 */
export function isSafeImageSrc(src: string): boolean {
  return src.startsWith('data:image/') || src.startsWith('https://')
}

export const LogoSchema = z.string().max(MAX_LOGO_LENGTH).refine(isSafeImageSrc, {
  error: 'logo must be a data:image/ or https:// URL',
})

export const LayoutThemeSchema = z.object({
  background: HexColourSchema.nullable(),
  accent: HexColourSchema.nullable(),
  fontScale: z.number().min(0.5).max(2),
  logo: LogoSchema.nullable(),
}) satisfies z.ZodType<LayoutTheme>

export const ThemePaletteSchema = z.object({
  bg: HexColourSchema,
  surface: HexColourSchema,
  text: HexColourSchema,
  muted: HexColourSchema,
  border: HexColourSchema,
  accent: HexColourSchema,
  accentSubtle: HexColourSchema,
  onAccent: HexColourSchema.nullable(),
  positive: HexColourSchema,
  negative: HexColourSchema,
}) satisfies z.ZodType<ThemePalette>

export const FontKeySchema = z.enum(FONT_KEYS)

/** A host theme (ADR 0022). Built-in theme ids are reserved, so a file can't shadow one. */
export const ThemeSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .refine(id => !BUILT_IN_THEME_IDS.includes(id), {
      error: 'id is reserved for a built-in theme',
    }),
  name: z.string().trim().min(1).max(60),
  light: ThemePaletteSchema,
  dark: ThemePaletteSchema.nullable(),
  fonts: z.object({ display: FontKeySchema, body: FontKeySchema, mono: FontKeySchema }),
  iconStroke: z.literal(ICON_STROKES),
  logo: z.object({ wordmark: LogoSchema.nullable(), mark: LogoSchema.nullable() }),
}) satisfies z.ZodType<Theme>

export const LayoutSchema = z.object({
  id: z.string(),
  gameId: z.string().nullable(),
  name: z.string(),
  target: z.enum(LAYOUT_TARGETS),
  phase: z.enum(GAME_PHASES).nullable().default(null),
  theme: LayoutThemeSchema.default(() => ({ ...DEFAULT_LAYOUT_THEME })),
  isActive: z.boolean(),
  order: z.number(),
}) satisfies z.ZodType<Layout>

export const WidgetSchema = z.object({
  id: z.string(),
  layoutId: z.string(),
  type: z.enum(WIDGET_TYPES),
  // Validated per type against the widget registry where configs are used (#410, #411),
  // since the db layer can't import the registry's UI components.
  config: z.record(z.string(), z.unknown()),
  grid: GridRectSchema,
  breakpoints: z
    .object({ phone: GridRectSchema.optional(), tv: GridRectSchema.optional() })
    .default({}),
  order: z.number(),
}) satisfies z.ZodType<Widget>

/**
 * Collections of a v1/v2 backup. Missing collections default to empty; v1's
 * `categories` array is stripped as an unknown key. Every widget must belong to a layout
 * in the same file.
 */
export const SnapshotSchema = z
  .object({
    difficulties: z.array(DifficultyLevelSchema).default([]),
    tags: z.array(TagSchema).default([]),
    questions: z.array(QuestionSchema).default([]),
    rounds: z.array(RoundSchema).default([]),
    games: z.array(GameSchema).default([]),
    gameQuestions: z.array(GameQuestionSchema).default([]),
    notes: z.array(NoteSchema).default([]),
    layouts: z.array(LayoutSchema).default([]),
    widgets: z.array(WidgetSchema).default([]),
    themes: z.array(ThemeSchema).default([]),
    settings: AppSettingsSchema.optional(),
  })
  .superRefine(({ layouts, widgets }, ctx) => {
    const layoutIds = new Set(layouts.map(l => l.id))
    widgets.forEach((w, i) => {
      if (!layoutIds.has(w.layoutId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['widgets', i, 'layoutId'],
          message: `no layout with id ${w.layoutId}`,
        })
      }
    })
  })

/** Accept numbers where strings are expected (e.g. `answer: 4`), as the old importer did. */
const numberToString = (v: unknown) => (typeof v === 'number' ? String(v) : v)

const requiredText = (field: string) =>
  z.preprocess(
    numberToString,
    z
      .string({ error: `missing ${field}` })
      .refine(s => s.trim().length > 0, { error: `missing ${field}` })
  )

const optionsError = 'options must be an array of strings'

/**
 * One row of a question-bank import file. `title`, `type` and `answer` are required
 * and `options` must be a string array when present; other fields fall back to
 * defaults when absent or malformed.
 */
export const QuestionImportRowSchema = z.object(
  {
    id: z.string().optional().catch(undefined),
    title: requiredText('title'),
    type: z.enum(QUESTION_TYPES, {
      error: iss => (iss.input === undefined ? 'missing type' : 'invalid type'),
    }),
    options: z
      .array(z.preprocess(numberToString, z.string({ error: optionsError })), {
        error: optionsError,
      })
      .default([]),
    answer: requiredText('answer'),
    description: z.string().catch(''),
    difficulty: z.string().nullable().catch(null),
    tags: z.array(z.string()).catch([]),
    media: z.string().nullable().catch(null),
    mediaType: MediaTypeSchema.catch(null),
    createdAt: z.number().optional().catch(undefined),
  },
  { error: 'expected an object' }
)
