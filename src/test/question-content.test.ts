// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import { buildQuestionContent } from '@/pages/admin/gamemaster-utils'
import {
  GameEventSchemas,
  MAX_MEDIA_LENGTH,
  MAX_OPTIONS,
  MAX_TEXT_LENGTH,
} from '@/transport/messages'
import type { Question, TargetVisibility } from '@/db'

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

  it('never sends the correct answer, even with everything shown', () => {
    const content = buildQuestionContent(QUESTION, 'players', ALL)
    expect(content.answer).toBeNull()
    expect(JSON.stringify(content)).not.toContain('"answer":"Paris"')
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
