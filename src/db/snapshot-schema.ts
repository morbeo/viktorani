import { z } from 'zod'
import type { DifficultyLevel, Tag, Question, Round, Game, Note } from '@/db'

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
    allowIndividual: z.boolean().default(true),
    allowLateJoin: z.boolean().default(true),
    allowRejoin: z.boolean().default(true),
    requireApproval: z.boolean().default(false),
    allowPlayerTeams: z.boolean().default(true),
    roundIds: z.array(z.string()),
    currentRoundIdx: z.number(),
    currentQuestionIdx: z.number(),
    buzzerLocked: z.boolean(),
    scoringEnabled: z.boolean().default(true),
    // Buzzer config was added after v1 backups; defaults mirror the game wizard.
    autoLockOnFirstCorrect: z.boolean().default(false),
    allowFalseStarts: z.boolean().default(false),
    buzzDeduplication: z.enum(['firstOnly', 'all']).default('firstOnly'),
    tiebreakerMode: z.literal('serverOrder').default('serverOrder'),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .transform(({ showQuestion, showAnswers, showMedia, visibility, ...game }) => {
    const flags = {
      showQuestion: showQuestion ?? true,
      showAnswers: showAnswers ?? false,
      showMedia: showMedia ?? true,
    }
    return { ...game, visibility: visibility ?? { players: { ...flags }, screen: { ...flags } } }
  }) satisfies z.ZodType<Game>

export const NoteSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
}) satisfies z.ZodType<Note>

/**
 * Collections of a v1/v2 backup. Missing collections default to empty; v1's
 * `categories` array is stripped as an unknown key.
 */
export const SnapshotSchema = z.object({
  difficulties: z.array(DifficultyLevelSchema).default([]),
  tags: z.array(TagSchema).default([]),
  questions: z.array(QuestionSchema).default([]),
  rounds: z.array(RoundSchema).default([]),
  games: z.array(GameSchema).default([]),
  notes: z.array(NoteSchema).default([]),
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
