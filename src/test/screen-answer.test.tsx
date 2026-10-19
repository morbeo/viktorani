import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScreenAnswers, ScreenQuestion } from '@/components/screen/screen-widgets'
import type { GameEvent } from '@/transport/types'

type QuestionContent = Extract<GameEvent, { type: 'QUESTION_CONTENT' }>

function content(patch: Partial<QuestionContent> = {}): QuestionContent {
  return {
    type: 'QUESTION_CONTENT',
    target: 'screen',
    questionId: 'q1',
    title: 'Capital of France?',
    description: null,
    options: ['Paris', 'Rome'],
    answer: null,
    media: null,
    mediaType: null,
    ...patch,
  }
}

describe('screen: revealed answer', () => {
  it('shows no answer before the reveal', () => {
    render(
      <>
        <ScreenQuestion content={content()} />
        <ScreenAnswers content={content()} />
      </>
    )
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Paris', { selector: 'li' })).not.toHaveAttribute('aria-current')
  })

  it('shows the answer and marks the correct option once revealed', () => {
    const revealed = content({ answer: 'Paris' })
    render(
      <>
        <ScreenQuestion content={revealed} />
        <ScreenAnswers content={revealed} />
      </>
    )
    expect(screen.getByRole('status')).toHaveTextContent('Answer: Paris')
    expect(screen.getByText('Paris', { selector: 'li' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('Rome', { selector: 'li' })).not.toHaveAttribute('aria-current')
  })
})
