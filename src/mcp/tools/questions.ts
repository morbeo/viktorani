import { z } from 'zod'
import { db } from '@/db'
import type { Question } from '@/db'
import { deleteQuestions } from '@/db/questions'
import { importQuestionRows } from '@/db/snapshot'
import { IdInput, PageInput, ToolError, defineTool, definedOnly, notFound, page } from '../tool'
import { resolveDifficulty, resolveTags } from './bank'

const TRUE_FALSE = ['True', 'False']

const QuestionType = z
  .enum(['multiple_choice', 'true_false', 'open_ended'])
  .describe('multiple_choice has 4 options, true_false has True/False, open_ended has none')

/** Fields a question is written with; tags and difficulty may be given by name. */
const QuestionFields = {
  title: z.string().trim().min(1).max(500).describe('The question as asked'),
  type: QuestionType,
  options: z
    .array(z.string().trim().min(1).max(200))
    .optional()
    .describe('Exactly 4 for multiple_choice; ignored for the other types'),
  answer: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('The correct answer; for multiple_choice and true_false, one of the options'),
  description: z.string().max(5000).describe('Markdown shown under the question'),
  difficulty: z.string().nullable().describe('Difficulty id or name, or null'),
  tags: z.array(z.string()).describe('Tag ids or names'),
  media: z
    .url({ protocol: /^https$/ })
    .max(2000)
    .nullable()
    .describe('https URL of an image, audio or video file, or null'),
  mediaType: z.enum(['image', 'audio', 'video']).nullable(),
}

type Draft = Pick<Question, 'title' | 'type' | 'answer' | 'description' | 'media' | 'mediaType'> & {
  options?: string[]
  difficulty: string | null
  tags: string[]
}

/** Check the type's option rules and resolve tag and difficulty names to ids. */
async function finish(draft: Draft) {
  let options: string[]
  if (draft.type === 'multiple_choice') {
    options = draft.options ?? []
    if (options.length !== 4) throw new ToolError('multiple_choice needs exactly 4 options')
    if (new Set(options).size !== 4) throw new ToolError('Options must be different')
  } else {
    options = draft.type === 'true_false' ? TRUE_FALSE : []
  }
  if (options.length && !options.includes(draft.answer)) {
    throw new ToolError(`answer must be one of: ${options.join(', ')}`)
  }
  if ((draft.media === null) !== (draft.mediaType === null)) {
    throw new ToolError('media and mediaType go together: give both or neither')
  }
  return {
    ...draft,
    options,
    tags: [...new Set(await resolveTags(draft.tags))],
    difficulty: await resolveDifficulty(draft.difficulty),
  }
}

/** A question as list tools return it: no media payload, tag names alongside ids. */
function brief(q: Question, tagNames: Map<string, string>) {
  return {
    id: q.id,
    title: q.title,
    type: q.type,
    answer: q.answer,
    options: q.options,
    difficulty: q.difficulty,
    tags: q.tags.map(id => tagNames.get(id) ?? id),
    hasMedia: q.media !== null,
  }
}

const listQuestions = defineTool({
  name: 'list_questions',
  title: 'List questions',
  description:
    'Search the question bank. Text matches the title, answer, options and description, ' +
    'ignoring case. Filters combine. Newest first.',
  kind: 'read',
  input: z.object({
    text: z.string().optional(),
    tag: z.string().optional().describe('Tag id or name'),
    difficulty: z.string().optional().describe('Difficulty id or name'),
    type: QuestionType.optional(),
    notInRound: z.boolean().default(false).describe('Only questions no round uses'),
    ...PageInput,
  }),
  async run({ text, tag, difficulty, type, notInRound, limit, offset }) {
    const [tagId] = tag ? await resolveTags([tag]) : []
    const difficultyId = difficulty ? await resolveDifficulty(difficulty) : undefined
    const needle = text?.toLowerCase()
    const used = notInRound
      ? new Set((await db.rounds.toArray()).flatMap(r => r.questionIds))
      : null
    const all = await db.questions.orderBy('createdAt').reverse().toArray()
    const matches = all.filter(
      q =>
        (!needle ||
          [q.title, q.answer, q.description, ...q.options].some(s =>
            s.toLowerCase().includes(needle)
          )) &&
        (!tagId || q.tags.includes(tagId)) &&
        (difficultyId === undefined || q.difficulty === difficultyId) &&
        (!type || q.type === type) &&
        (!used || !used.has(q.id))
    )
    const tagNames = new Map((await db.tags.toArray()).map(t => [t.id, t.name]))
    return page(
      matches.map(q => brief(q, tagNames)),
      limit,
      offset
    )
  },
})

const getQuestion = defineTool({
  name: 'get_question',
  title: 'Get question',
  description: 'One question in full, with the rounds that use it.',
  kind: 'read',
  input: IdInput,
  async run({ id }) {
    const question = (await db.questions.get(id)) ?? notFound('question', id)
    const rounds = await db.rounds.filter(r => r.questionIds.includes(id)).toArray()
    return { ...question, rounds: rounds.map(r => ({ id: r.id, name: r.name })) }
  },
})

const createQuestion = defineTool({
  name: 'create_question',
  title: 'Create question',
  description:
    'Add a question to the bank. To add many at once, use import_questions. ' +
    'Add it to a round with update_round.',
  kind: 'write',
  input: z.object({
    ...QuestionFields,
    description: QuestionFields.description.default(''),
    difficulty: QuestionFields.difficulty.default(null),
    tags: QuestionFields.tags.default([]),
    media: QuestionFields.media.default(null),
    mediaType: QuestionFields.mediaType.default(null),
  }),
  async run(args) {
    const now = Date.now()
    const question: Question = {
      id: crypto.randomUUID(),
      ...(await finish(args)),
      createdAt: now,
      updatedAt: now,
    }
    await db.questions.add(question)
    return question
  },
})

const updateQuestion = defineTool({
  name: 'update_question',
  title: 'Update question',
  description:
    'Change any fields of a question; the rest stay. Changing type resets the options ' +
    '(give new ones for multiple_choice) and needs a matching answer.',
  kind: 'write',
  input: IdInput.extend(z.object(QuestionFields).partial().shape),
  async run({ id, ...patch }) {
    const stored = (await db.questions.get(id)) ?? notFound('question', id)
    const next = { ...stored, ...definedOnly(patch) }
    const question: Question = {
      ...stored,
      ...(await finish(next)),
      updatedAt: Date.now(),
    }
    await db.questions.put(question)
    return question
  },
})

const deleteQuestionsTool = defineTool({
  name: 'delete_questions',
  title: 'Delete questions',
  description:
    'Delete questions and take them out of every round and game, as the app does. ' +
    'Reaches the app only through Replace from JSON.',
  kind: 'delete',
  input: z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }),
  async run({ ids }) {
    const stored = await db.questions.bulkGet(ids)
    const missing = ids.find((_, i) => !stored[i])
    if (missing) notFound('question', missing)
    await deleteQuestions(ids)
    return { deleted: ids.length }
  },
})

const importQuestions = defineTool({
  name: 'import_questions',
  title: 'Import questions',
  description:
    'Add or update many questions in the question-file format of Questions → Import ' +
    '(title, type, options, answer, description, difficulty id, tag ids). ' +
    'Rows with an id overwrite that question. Invalid rows are skipped and reported.',
  kind: 'write',
  input: z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000) }),
  async run({ rows }) {
    return importQuestionRows(rows)
  },
})

export const QUESTION_TOOLS = [
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestionsTool,
  importQuestions,
]
