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
  description: z.string(),
  difficulty: z.string().nullable(),
  tags: z.array(z.string()),
  media: z.string().nullable(),
  mediaType: MediaTypeSchema,
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

export const GameSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['waiting', 'active', 'paused', 'ended']),
  transportMode: z.enum(['auto', 'peer', 'gun']),
  roomId: z.string().nullable(),
  passphrase: z.string().nullable(),
  showQuestion: z.boolean(),
  showAnswers: z.boolean(),
  showMedia: z.boolean(),
  maxTeams: z.number(),
  maxPerTeam: z.number(),
  allowIndividual: z.boolean(),
  roundIds: z.array(z.string()),
  currentRoundIdx: z.number(),
  currentQuestionIdx: z.number(),
  buzzerLocked: z.boolean(),
  scoringEnabled: z.boolean(),
  autoLockOnFirstCorrect: z.boolean(),
  allowFalseStarts: z.boolean(),
  buzzDeduplication: z.enum(['firstOnly', 'all']),
  tiebreakerMode: z.literal('serverOrder'),
  createdAt: z.number(),
  updatedAt: z.number(),
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

const requiredText = (field: string) =>
  z
    .string({ error: `missing ${field}` })
    .refine(s => s.trim().length > 0, { error: `missing ${field}` })

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
    options: z.array(z.string({ error: optionsError }), { error: optionsError }).default([]),
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
