// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerQuestion, isSafeMedia } from '@/pages/player/PlayerQuestion'
import type { QuestionContent } from '@/pages/player/player-session'

function content(patch: Partial<QuestionContent> = {}): QuestionContent {
  return {
    type: 'QUESTION_CONTENT',
    target: 'players',
    questionId: 'q1',
    title: null,
    description: null,
    options: null,
    answer: null,
    media: null,
    mediaType: null,
    ...patch,
  }
}

describe('isSafeMedia', () => {
  it('accepts data URLs of the announced kind and https URLs', () => {
    expect(isSafeMedia('data:image/png;base64,AAAA', 'image')).toBe(true)
    expect(isSafeMedia('data:audio/mpeg;base64,AAAA', 'audio')).toBe(true)
    expect(isSafeMedia('https://example.com/clip.mp4', 'video')).toBe(true)
  })

  it('rejects other schemes and mismatched data types', () => {
    expect(isSafeMedia('javascript:alert(1)', 'image')).toBe(false)
    expect(isSafeMedia('http://example.com/a.png', 'image')).toBe(false)
    expect(isSafeMedia('data:text/html;base64,AAAA', 'image')).toBe(false)
    expect(isSafeMedia('data:image/png;base64,AAAA', 'video')).toBe(false)
  })
})

describe('PlayerQuestion', () => {
  it('renders the visible fields', () => {
    render(
      <PlayerQuestion
        question={content({
          title: 'Capital of France?',
          description: 'Think **carefully**',
          options: ['Paris', 'Lyon'],
          media: 'data:image/png;base64,AAAA',
          mediaType: 'image',
        })}
      />
    )
    expect(screen.getByRole('heading', { name: 'Capital of France?' })).toBeInTheDocument()
    expect(screen.getByText('carefully').tagName).toBe('STRONG')
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('Lyon')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Question media' })).toHaveAttribute(
      'src',
      'data:image/png;base64,AAAA'
    )
  })

  it('strips unsafe markup from the description', () => {
    const { container } = render(
      <PlayerQuestion
        question={content({ description: '<img src=x onerror="alert(1)"><script>x()</script>' })}
      />
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('[onerror]')).toBeNull()
  })

  it('drops media with an unsafe source', () => {
    const { container } = render(
      <PlayerQuestion
        question={content({ title: 'Listen', media: 'javascript:alert(1)', mediaType: 'audio' })}
      />
    )
    expect(container.querySelector('audio')).toBeNull()
  })

  it('renders nothing when the host hides every field', () => {
    const { container } = render(<PlayerQuestion question={content()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
