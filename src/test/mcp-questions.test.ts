// @vitest-pool vmForks
// MCP question-bank tools (#519): tags, difficulties, questions and rounds.
import { describe, it, expect } from 'vitest'
import { db } from '@/db'
import type { Question, Round } from '@/db'
import { setUp } from './mcp-harness'

const mc = { title: 'Capital of France?', type: 'multiple_choice', answer: 'Paris' }
const OPTIONS = ['Berlin', 'Madrid', 'Paris', 'Rome']

describe('tags and difficulties', () => {
  it('creates, renames and lists tags with their use', async () => {
    const { call } = await setUp()
    const tag = await call<{ id: string }>('create_tag', { name: 'Geography' })
    await expect(call('create_tag', { name: 'geography' })).rejects.toThrow(/already exists/)
    await call('update_tag', { id: tag.id, name: 'Places', color: '#123456' })
    await call('create_question', { ...mc, options: OPTIONS, tags: ['places'] })
    expect(await call('list_tags')).toEqual([
      { id: tag.id, name: 'Places', color: '#123456', questions: 1 },
    ])
  })

  it('refuses to delete a tag in use, as the app does', async () => {
    const { call } = await setUp()
    const tag = await call<{ id: string }>('create_tag', { name: 'Music' })
    const q = await call<Question>('create_question', { ...mc, options: OPTIONS, tags: [tag.id] })
    await expect(call('delete_tag', { id: tag.id })).rejects.toThrow(/used by 1/)
    await call('update_question', { id: q.id, tags: [] })
    await call('delete_tag', { id: tag.id })
    expect(await db.tags.count()).toBe(0)
  })

  it('adds difficulties last and renumbers after a delete', async () => {
    const { call } = await setUp()
    const easy = await call<{ id: string }>('create_difficulty', { name: 'Easy', score: 1 })
    await call('create_difficulty', { name: 'Hard', score: 3 })
    await call('update_difficulty', { id: easy.id, score: 2 })
    await call('delete_difficulty', { id: easy.id })
    const levels = await call<{ name: string; order: number }[]>('list_difficulties')
    expect(levels).toMatchObject([{ name: 'Hard', order: 0, questions: 0 }])
  })

  it('refuses to delete a difficulty in use', async () => {
    const { call } = await setUp()
    const easy = await call<{ id: string }>('create_difficulty', { name: 'Easy', score: 1 })
    await call('create_question', { ...mc, options: OPTIONS, difficulty: 'easy' })
    await expect(call('delete_difficulty', { id: easy.id })).rejects.toThrow(/used by 1/)
  })
})

describe('questions', () => {
  it('creates each type with its options', async () => {
    const { call } = await setUp()
    const q1 = await call<Question>('create_question', { ...mc, options: OPTIONS })
    const q2 = await call<Question>('create_question', {
      title: 'The sun is a star',
      type: 'true_false',
      answer: 'True',
      options: ['ignored'],
    })
    const q3 = await call<Question>('create_question', {
      title: 'Name a planet',
      type: 'open_ended',
      answer: 'Mars',
    })
    expect(q1.options).toEqual(OPTIONS)
    expect(q2.options).toEqual(['True', 'False'])
    expect(q3).toMatchObject({ options: [], difficulty: null, tags: [], media: null })
  })

  it('rejects answers and options that break the type rules', async () => {
    const { call } = await setUp()
    await expect(call('create_question', { ...mc, options: ['a', 'b'] })).rejects.toThrow(
      /exactly 4/
    )
    await expect(call('create_question', { ...mc, options: ['a', 'a', 'b', 'c'] })).rejects.toThrow(
      /different/
    )
    await expect(
      call('create_question', { ...mc, answer: 'Lyon', options: OPTIONS })
    ).rejects.toThrow(/one of/)
    await expect(
      call('create_question', { ...mc, options: OPTIONS, tags: ['nope'] })
    ).rejects.toThrow(/create_tag/)
    await expect(
      call('create_question', {
        ...mc,
        options: OPTIONS,
        media: 'http://example.com/a.png',
        mediaType: 'image',
      })
    ).rejects.toThrow(/Invalid input: media/)
    await expect(
      call('create_question', { ...mc, options: OPTIONS, media: 'https://example.com/a.png' })
    ).rejects.toThrow(/go together/)
    expect(await db.questions.count()).toBe(0)
  })

  it('updates only the fields given', async () => {
    const { call } = await setUp()
    const q = await call<Question>('create_question', { ...mc, options: OPTIONS })
    const updated = await call<Question>('update_question', { id: q.id, title: 'France?' })
    expect(updated).toMatchObject({ title: 'France?', answer: 'Paris', options: OPTIONS })
    await expect(call('update_question', { id: q.id, type: 'true_false' })).rejects.toThrow(
      /True, False/
    )
    const tf = await call<Question>('update_question', {
      id: q.id,
      type: 'true_false',
      answer: 'False',
    })
    expect(tf.options).toEqual(['True', 'False'])
  })

  it('searches by text, tag, type and round use', async () => {
    const { call } = await setUp()
    await call('create_tag', { name: 'Space' })
    const star = await call<Question>('create_question', {
      title: 'The sun is a star',
      type: 'true_false',
      answer: 'True',
      tags: ['Space'],
    })
    await call('create_question', { ...mc, options: OPTIONS })
    await call('create_round', { name: 'R1', questionIds: [star.id] })
    const search = (args: object) =>
      call<{ total: number; items: { title: string }[] }>('list_questions', args)
    expect((await search({ text: 'MADRID' })).items.map(q => q.title)).toEqual([mc.title])
    expect((await search({ tag: 'space' })).items).toMatchObject([{ tags: ['Space'] }])
    expect((await search({ type: 'true_false' })).total).toBe(1)
    expect((await search({ notInRound: true })).items.map(q => q.title)).toEqual([mc.title])
    expect(await search({ limit: 1, offset: 1 })).toMatchObject({ total: 2, items: [{}] })
  })

  it('deletes questions from the bank, rounds and games', async () => {
    const { call } = await setUp()
    const q = await call<Question>('create_question', { ...mc, options: OPTIONS })
    const round = await call<Round>('create_round', { name: 'R1', questionIds: [q.id] })
    await call('create_game', { name: 'Night', roundIds: [round.id] })
    await expect(call('delete_questions', { ids: [q.id, 'nope'] })).rejects.toThrow(/"nope"/)
    await call('delete_questions', { ids: [q.id] })
    expect(await db.questions.count()).toBe(0)
    expect((await db.rounds.get(round.id))!.questionIds).toEqual([])
    expect(await db.gameQuestions.count()).toBe(0)
  })

  it('imports rows in the question-file format', async () => {
    const { call } = await setUp()
    const result = await call('import_questions', {
      rows: [{ title: 'Q', type: 'open_ended', answer: 'A' }, { title: 'No answer' }],
    })
    expect(result).toMatchObject({ imported: 1, skipped: 1 })
    expect(await db.questions.count()).toBe(1)
  })

  it('gets a question with the rounds using it', async () => {
    const { call } = await setUp()
    const q = await call<Question>('create_question', { ...mc, options: OPTIONS })
    await call('create_round', { name: 'R1', questionIds: [q.id] })
    expect(await call('get_question', { id: q.id })).toMatchObject({
      title: mc.title,
      rounds: [{ name: 'R1' }],
    })
    await expect(call('get_question', { id: 'nope' })).rejects.toThrow(/No question/)
  })
})

describe('rounds', () => {
  it('builds a round and edits its questions', async () => {
    const { call } = await setUp()
    const ids: string[] = []
    for (const title of ['A', 'B', 'C']) {
      ids.push(
        (await call<Question>('create_question', { title, type: 'open_ended', answer: 'x' })).id
      )
    }
    const round = await call<Round>('create_round', { name: 'R1', questionIds: [ids[0], ids[0]] })
    expect(round.questionIds).toEqual([ids[0]])
    await call('update_round', { id: round.id, add: [ids[1], ids[2]], remove: [ids[0]] })
    expect(await call('get_round', { id: round.id })).toMatchObject({
      questions: [{ title: 'B' }, { title: 'C' }],
    })
    await call('update_round', { id: round.id, questionIds: [ids[2], ids[1]], name: 'Final' })
    expect(await db.rounds.get(round.id)).toMatchObject({
      name: 'Final',
      questionIds: [ids[2], ids[1]],
    })
    await expect(
      call('update_round', { id: round.id, questionIds: [], add: [ids[0]] })
    ).rejects.toThrow(/not both/)
    await expect(call('create_round', { name: 'X', questionIds: ['nope'] })).rejects.toThrow(
      /No question/
    )
  })

  it('lists rounds with the games using them and deletes them', async () => {
    const { call } = await setUp()
    const q = await call<Question>('create_question', { ...mc, options: OPTIONS })
    const round = await call<Round>('create_round', { name: 'R1', questionIds: [q.id] })
    await call('create_game', { name: 'Night', roundIds: [round.id] })
    expect(await call('list_rounds')).toMatchObject({
      total: 1,
      items: [{ name: 'R1', questions: 1, games: ['Night'] }],
    })
    await call('delete_round', { id: round.id })
    expect(await db.rounds.count()).toBe(0)
    expect(await db.questions.count()).toBe(1)
  })
})
