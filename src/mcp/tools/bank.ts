import { z } from 'zod'
import { db } from '@/db'
import type { DifficultyLevel, Tag } from '@/db'
import { HexColourSchema } from '@/db/snapshot-schema'
import { IdInput, ToolError, defineTool, definedOnly, notFound } from '../tool'

/** Default colour for a tag or difficulty created without one. */
const DEFAULT_COLOUR = '#C9A84C'

const Name = z.string().trim().min(1).max(60)

/** The tag ids for `refs`, each a tag id or a tag name (any case). */
export async function resolveTags(refs: string[]): Promise<string[]> {
  if (!refs.length) return []
  const tags = await db.tags.toArray()
  return refs.map(ref => {
    const tag =
      tags.find(t => t.id === ref) ?? tags.find(t => t.name.toLowerCase() === ref.toLowerCase())
    if (!tag) throw new ToolError(`No tag "${ref}". Create it with create_tag first.`)
    return tag.id
  })
}

/** The difficulty id for `ref`, a difficulty id or name (any case), or `null` for none. */
export async function resolveDifficulty(ref: string | null): Promise<string | null> {
  if (ref === null) return null
  const levels = await db.difficulties.toArray()
  const level =
    levels.find(d => d.id === ref) ?? levels.find(d => d.name.toLowerCase() === ref.toLowerCase())
  if (!level) {
    throw new ToolError(
      `No difficulty "${ref}". Known: ${levels.map(d => d.name).join(', ') || 'none'}.`
    )
  }
  return level.id
}

// ── Tags ──────────────────────────────────────────────────────────────────────

const listTags = defineTool({
  name: 'list_tags',
  title: 'List tags',
  description: 'Every tag, with how many questions use it.',
  kind: 'read',
  input: z.object({}),
  async run() {
    const [tags, questions] = await Promise.all([db.tags.toArray(), db.questions.toArray()])
    return tags.map(t => ({ ...t, questions: questions.filter(q => q.tags.includes(t.id)).length }))
  },
})

const createTag = defineTool({
  name: 'create_tag',
  title: 'Create tag',
  description: 'Add a tag for classifying questions. Names are unique, ignoring case.',
  kind: 'write',
  input: z.object({
    name: Name,
    color: HexColourSchema.default(DEFAULT_COLOUR).describe('Hex colour such as #9B59B6'),
  }),
  async run({ name, color }) {
    const clash = await db.tags.filter(t => t.name.toLowerCase() === name.toLowerCase()).first()
    if (clash) throw new ToolError(`Tag "${clash.name}" already exists (id ${clash.id})`)
    const tag: Tag = { id: crypto.randomUUID(), name, color }
    await db.tags.add(tag)
    return tag
  },
})

const updateTag = defineTool({
  name: 'update_tag',
  title: 'Update tag',
  description: 'Rename a tag or change its colour.',
  kind: 'write',
  input: IdInput.extend({ name: Name.optional(), color: HexColourSchema.optional() }),
  async run({ id, ...patch }) {
    const tag = (await db.tags.get(id)) ?? notFound('tag', id)
    const next = { ...tag, ...definedOnly(patch) }
    await db.tags.put(next)
    return next
  },
})

const deleteTag = defineTool({
  name: 'delete_tag',
  title: 'Delete tag',
  description: 'Delete a tag. Refuses while any question uses it, as the app does.',
  kind: 'delete',
  input: IdInput,
  async run({ id }) {
    const tag = (await db.tags.get(id)) ?? notFound('tag', id)
    const used = await db.questions.filter(q => q.tags.includes(id)).count()
    if (used) throw new ToolError(`"${tag.name}" is used by ${used} question(s); untag them first.`)
    await db.tags.delete(id)
    return { deleted: id }
  },
})

// ── Difficulties ──────────────────────────────────────────────────────────────

const listDifficulties = defineTool({
  name: 'list_difficulties',
  title: 'List difficulties',
  description: 'Every difficulty level in order, with its points and how many questions use it.',
  kind: 'read',
  input: z.object({}),
  async run() {
    const [levels, questions] = await Promise.all([
      db.difficulties.orderBy('order').toArray(),
      db.questions.toArray(),
    ])
    return levels.map(d => ({
      ...d,
      questions: questions.filter(q => q.difficulty === d.id).length,
    }))
  },
})

const Score = z.number().int().min(0).max(1000).describe('Points a correct answer scores')

const createDifficulty = defineTool({
  name: 'create_difficulty',
  title: 'Create difficulty',
  description: 'Add a difficulty level, placed last. Names are unique, ignoring case.',
  kind: 'write',
  input: z.object({
    name: Name,
    score: Score,
    color: HexColourSchema.default(DEFAULT_COLOUR),
  }),
  async run({ name, score, color }) {
    const levels = await db.difficulties.toArray()
    const clash = levels.find(d => d.name.toLowerCase() === name.toLowerCase())
    if (clash) throw new ToolError(`Difficulty "${clash.name}" already exists (id ${clash.id})`)
    const level: DifficultyLevel = {
      id: crypto.randomUUID(),
      name,
      score,
      color,
      order: levels.reduce((max, d) => Math.max(max, d.order + 1), 0),
    }
    await db.difficulties.add(level)
    return level
  },
})

const updateDifficulty = defineTool({
  name: 'update_difficulty',
  title: 'Update difficulty',
  description: "Change a difficulty level's name, points or colour.",
  kind: 'write',
  input: IdInput.extend({
    name: Name.optional(),
    score: Score.optional(),
    color: HexColourSchema.optional(),
  }),
  async run({ id, ...patch }) {
    const level = (await db.difficulties.get(id)) ?? notFound('difficulty', id)
    const next = { ...level, ...definedOnly(patch) }
    await db.difficulties.put(next)
    return next
  },
})

const deleteDifficulty = defineTool({
  name: 'delete_difficulty',
  title: 'Delete difficulty',
  description: 'Delete a difficulty level. Refuses while any question uses it, as the app does.',
  kind: 'delete',
  input: IdInput,
  async run({ id }) {
    const level = (await db.difficulties.get(id)) ?? notFound('difficulty', id)
    const used = await db.questions.where('difficulty').equals(id).count()
    if (used) throw new ToolError(`"${level.name}" is used by ${used} question(s).`)
    await db.transaction('rw', db.difficulties, async () => {
      await db.difficulties.delete(id)
      const rest = await db.difficulties.orderBy('order').toArray()
      await db.difficulties.bulkPut(rest.map((d, i) => ({ ...d, order: i })))
    })
    return { deleted: id }
  },
})

export const BANK_TOOLS = [
  listTags,
  createTag,
  updateTag,
  deleteTag,
  listDifficulties,
  createDifficulty,
  updateDifficulty,
  deleteDifficulty,
]
