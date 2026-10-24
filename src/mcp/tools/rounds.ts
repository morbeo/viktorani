import { z } from 'zod'
import { db } from '@/db'
import type { Round } from '@/db'
import { IdInput, PageInput, ToolError, defineTool, definedOnly, notFound, page } from '../tool'

const Name = z.string().trim().min(1).max(100)
const QuestionIds = z.array(z.string().min(1)).max(500)

/** Throw unless every id in `ids` is a stored question; returns them without repeats. */
export async function checkQuestionIds(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)]
  const stored = await db.questions.bulkGet(unique)
  const missing = unique.find((_, i) => !stored[i])
  if (missing) notFound('question', missing)
  return unique
}

const listRounds = defineTool({
  name: 'list_rounds',
  title: 'List rounds',
  description: 'Every round, newest first, with its question count and the games that use it.',
  kind: 'read',
  input: z.object(PageInput),
  async run({ limit, offset }) {
    const [rounds, games] = await Promise.all([
      db.rounds.orderBy('createdAt').reverse().toArray(),
      db.games.toArray(),
    ])
    return page(
      rounds.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        questions: r.questionIds.length,
        games: games.filter(g => g.roundIds.includes(r.id)).map(g => g.name),
      })),
      limit,
      offset
    )
  },
})

const getRound = defineTool({
  name: 'get_round',
  title: 'Get round',
  description: 'One round with its questions in order.',
  kind: 'read',
  input: IdInput,
  async run({ id }) {
    const round = (await db.rounds.get(id)) ?? notFound('round', id)
    const questions = await db.questions.bulkGet(round.questionIds)
    return {
      ...round,
      questions: questions.map((q, i) =>
        q
          ? { id: q.id, title: q.title, type: q.type, answer: q.answer }
          : { id: round.questionIds[i], missing: true }
      ),
    }
  },
})

const createRound = defineTool({
  name: 'create_round',
  title: 'Create round',
  description: 'Add a round of existing questions, in the order given.',
  kind: 'write',
  input: z.object({
    name: Name,
    description: z.string().max(1000).default(''),
    questionIds: QuestionIds.default([]),
  }),
  async run({ name, description, questionIds }) {
    const round: Round = {
      id: crypto.randomUUID(),
      name,
      description,
      questionIds: await checkQuestionIds(questionIds),
      createdAt: Date.now(),
    }
    await db.rounds.add(round)
    return round
  },
})

const updateRound = defineTool({
  name: 'update_round',
  title: 'Update round',
  description:
    'Rename a round or change its questions: questionIds replaces the list, add appends ' +
    'and remove takes out. Games already created keep the questions they were created with.',
  kind: 'write',
  input: IdInput.extend({
    name: Name.optional(),
    description: z.string().max(1000).optional(),
    questionIds: QuestionIds.optional().describe('The whole new list, in order'),
    add: QuestionIds.optional().describe('Question ids to append'),
    remove: QuestionIds.optional().describe('Question ids to take out'),
  }),
  async run({ id, name, description, questionIds, add, remove }) {
    const round = (await db.rounds.get(id)) ?? notFound('round', id)
    if (questionIds && (add || remove)) {
      throw new ToolError('Give either questionIds or add/remove, not both')
    }
    let ids = questionIds ?? round.questionIds
    if (add) ids = [...ids, ...add]
    if (remove) ids = ids.filter(q => !remove.includes(q))
    const next: Round = {
      ...round,
      ...definedOnly({ name, description }),
      questionIds: await checkQuestionIds(ids),
    }
    await db.rounds.put(next)
    return next
  },
})

const deleteRound = defineTool({
  name: 'delete_round',
  title: 'Delete round',
  description:
    'Delete a round, as the app does. Its questions stay in the bank, and games already ' +
    'created keep their questions.',
  kind: 'delete',
  input: IdInput,
  async run({ id }) {
    if (!(await db.rounds.get(id))) notFound('round', id)
    await db.rounds.delete(id)
    return { deleted: id }
  },
})

export const ROUND_TOOLS = [listRounds, getRound, createRound, updateRound, deleteRound]
