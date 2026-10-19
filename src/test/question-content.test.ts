// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import { buildQuestionContent, buildRoundAnswers } from '@/pages/admin/gamemaster-utils'
import {
  GameEventSchemas,
  MAX_MEDIA_LENGTH,
  MAX_OPTIONS,
  MAX_TEXT_LENGTH,
} from '@/transport/messages'
import type { GameQuestion, Question, TargetVisibility } from '@/db'

const QUESTION: Question = {
  id: 'q1',
  title: 'Capital of France?',
  type: 'multiple_choice',
  options: ['Paris', 'Lyon', 'Nice'],
  answer: 'Paris',
  description: 'Think **big**',
  difficulty: null,
  tags: [],
  media: 'data:image/png;base64,AAAA',
  mediaType: 'image',
  createdAt: 0,
  updatedAt: 0,
}

const ALL: TargetVisibility = { showQuestion: true, showAnswers: true, showMedia: true }
const NONE: TargetVisibility = { showQuestion: false, showAnswers: false, showMedia: false }

describe('buildQuestionContent', () => {
  it('sends nothing but the question id when everything is hidden', () => {
    expect(buildQuestionContent(QUESTION, 'players', NONE)).toEqual({
      type: 'QUESTION_CONTENT',
      target: 'players',
      questionId: 'q1',
      title: null,
      description: null,
      options: null,
      answer: null,
      choices: null,
      acceptsText: false,
      media: null,
      mediaType: null,
    })
  })

  it('includes each part only when its switch is on', () => {
    const question = buildQuestionContent(QUESTION, 'players', { ...NONE, showQuestion: true })
    expect(question.title).toBe('Capital of France?')
    expect(question.description).toBe('Think **big**')
    expect(question.options).toBeNull()
    expect(question.media).toBeNull()

    const options = buildQuestionContent(QUESTION, 'players', { ...NONE, showAnswers: true })
    expect(options.title).toBeNull()
    expect(options.options).toEqual(['Paris', 'Lyon', 'Nice'])

    const media = buildQuestionContent(QUESTION, 'screen', { ...NONE, showMedia: true })
    expect(media.target).toBe('screen')
    expect(media.media).toBe(QUESTION.media)
    expect(media.mediaType).toBe('image')
  })

  it('never sends the correct answer before the reveal, even with everything shown', () => {
    const content = buildQuestionContent(QUESTION, 'players', ALL)
    expect(content.answer).toBeNull()
    expect(JSON.stringify(content)).not.toContain('"answer":"Paris"')
  })

  it('sends the correct answer only once the question is revealed', () => {
    expect(buildQuestionContent(QUESTION, 'players', ALL, false).answer).toBeNull()
    expect(buildQuestionContent(QUESTION, 'screen', ALL, true).answer).toBe('Paris')
    const hidden = { showQuestion: false, showAnswers: false, showMedia: false }
    expect(buildQuestionContent(QUESTION, 'players', hidden, true).answer).toBe('Paris')
  })

  it('says how many options players may pick from only while choices are taken', () => {
    expect(buildQuestionContent(QUESTION, 'players', NONE).choices).toBeNull()
    expect(buildQuestionContent(QUESTION, 'players', NONE, false, 'choice').choices).toBe(3)
    const tf = { ...QUESTION, type: 'true_false' as const, options: [] }
    expect(buildQuestionContent(tf, 'players', NONE, false, 'choice').choices).toBe(2)
    const open = { ...QUESTION, type: 'open_ended' as const, options: [] }
    expect(buildQuestionContent(open, 'players', ALL, false, 'choice').choices).toBeNull()
  })

  it('says typed answers are taken only while they are', () => {
    expect(buildQuestionContent(QUESTION, 'players', NONE).acceptsText).toBe(false)
    const content = buildQuestionContent(QUESTION, 'players', NONE, false, 'text')
    expect(content.acceptsText).toBe(true)
    expect(content.choices).toBeNull()
  })

  it('uses True/False options for true/false and none for open-ended questions', () => {
    const tf = { ...QUESTION, type: 'true_false' as const, options: [] }
    expect(buildQuestionContent(tf, 'players', ALL).options).toEqual(['True', 'False'])
    const open = { ...QUESTION, type: 'open_ended' as const, options: [] }
    expect(buildQuestionContent(open, 'players', ALL).options).toBeNull()
  })

  it('sends no description or media type when the question has none', () => {
    const plain = { ...QUESTION, description: '', media: null, mediaType: null }
    const content = buildQuestionContent(plain, 'players', ALL)
    expect(content.description).toBeNull()
    expect(content.media).toBeNull()
    expect(content.mediaType).toBeNull()
  })

  it('clips oversized fields so the message always passes validation', () => {
    const huge: Question = {
      ...QUESTION,
      title: 'x'.repeat(MAX_TEXT_LENGTH + 10),
      options: Array.from({ length: MAX_OPTIONS + 5 }, (_, i) => `${i}`.repeat(MAX_TEXT_LENGTH)),
      media: 'm'.repeat(MAX_MEDIA_LENGTH + 1),
    }
    const content = buildQuestionContent(huge, 'players', ALL)
    expect(content.title).toHaveLength(MAX_TEXT_LENGTH)
    expect(content.options).toHaveLength(MAX_OPTIONS)
    expect(content.media).toBeNull()
    expect(content.mediaType).toBeNull()
    expect(GameEventSchemas.QUESTION_CONTENT.safeParse(content).success).toBe(true)
  })
})

describe('buildRoundAnswers', () => {
  function row(n: number, patch: Partial<GameQuestion> = {}, question: Partial<Question> = {}) {
    return {
      gameQuestion: {
        id: `gq${n}`,
        gameId: 'g1',
        questionId: `q${n}`,
        roundId: 'r1',
        order: n,
        status: 'correct' as const,
        revealed: true,
        ...patch,
      },
      question: { ...QUESTION, id: `q${n}`, title: `Question ${n}`, answer: `A${n}`, ...question },
    }
  }

  it('sends only the revealed answers, numbered by their place in the round', () => {
    const event = buildRoundAnswers(
      'Round 1',
      'list',
      [row(1), row(2, { revealed: false }), row(3, { status: 'incorrect' })],
      'players',
      ALL
    )
    expect(event.review?.items).toEqual([
      { questionId: 'q1', number: 1, title: 'Question 1', answer: 'A1', status: 'correct' },
      { questionId: 'q3', number: 3, title: 'Question 3', answer: 'A3', status: 'incorrect' },
    ])
    expect(GameEventSchemas.ROUND_ANSWERS.safeParse(event).success).toBe(true)
  })

  it('leaves out the titles the target may not see, and questions with no answer', () => {
    const event = buildRoundAnswers(
      'R',
      'table',
      [row(1), row(2, {}, { answer: '' })],
      'screen',
      NONE
    )
    expect(event.review?.items).toEqual([
      { questionId: 'q1', number: 1, title: null, answer: 'A1', status: 'correct' },
    ])
    expect(event.target).toBe('screen')
    expect(event.review?.view).toBe('table')
  })

  it('clips oversized fields so the message always passes validation', () => {
    const event = buildRoundAnswers(
      'R'.repeat(1000),
      'list',
      [row(1, {}, { answer: 'x'.repeat(MAX_TEXT_LENGTH + 1) })],
      'players',
      ALL
    )
    expect(GameEventSchemas.ROUND_ANSWERS.safeParse(event).success).toBe(true)
  })
})
