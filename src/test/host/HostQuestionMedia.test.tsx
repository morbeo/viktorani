import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HostQuestionMedia } from '@/components/host/HostQuestionMedia'
import type { Question } from '@/db'

const BASE: Question = {
  id: 'q1',
  title: 'Q',
  type: 'multiple_choice',
  options: [],
  answer: '',
  description: '',
  difficulty: null,
  tags: [],
  media: null,
  mediaType: null,
  createdAt: 0,
  updatedAt: 0,
}
function q(o: Partial<Question>): Question {
  return { ...BASE, ...o }
}

describe('HostQuestionMedia — no media', () => {
  it('renders nothing when media is null', () => {
    const { container } = render(<HostQuestionMedia question={q({})} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders nothing when only media is set', () => {
    const { container } = render(
      <HostQuestionMedia question={q({ media: 'https://x.com/img.png', mediaType: null })} />
    )
    expect(container).toBeEmptyDOMElement()
  })
  it('renders nothing when only mediaType is set', () => {
    const { container } = render(
      <HostQuestionMedia question={q({ media: null, mediaType: 'image' })} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('HostQuestionMedia — image', () => {
  const imgQ = q({ media: 'https://example.com/photo.jpg', mediaType: 'image' })
  it('renders an img with correct src', () => {
    render(<HostQuestionMedia question={imgQ} />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })
  it('renders "Media" label', () => {
    render(<HostQuestionMedia question={imgQ} />)
    expect(screen.getByText('Media')).toBeInTheDocument()
  })
  it('does not render audio or video', () => {
    render(<HostQuestionMedia question={imgQ} />)
    expect(document.querySelector('audio')).not.toBeInTheDocument()
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })
})

describe('HostQuestionMedia — audio', () => {
  const audioQ = q({ media: 'https://example.com/clip.mp3', mediaType: 'audio' })
  it('renders audio with correct src and controls', () => {
    render(<HostQuestionMedia question={audioQ} />)
    const audio = document.querySelector('audio')
    expect(audio).toBeInTheDocument()
    expect(audio).toHaveAttribute('src', 'https://example.com/clip.mp3')
    expect(audio).toHaveAttribute('controls')
  })
  it('does not render img or video', () => {
    render(<HostQuestionMedia question={audioQ} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })
})

describe('HostQuestionMedia — video', () => {
  const videoQ = q({ media: 'https://example.com/clip.mp4', mediaType: 'video' })
  it('renders video with correct src and controls', () => {
    render(<HostQuestionMedia question={videoQ} />)
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', 'https://example.com/clip.mp4')
    expect(video).toHaveAttribute('controls')
  })
  it('does not render img or audio', () => {
    render(<HostQuestionMedia question={videoQ} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('audio')).not.toBeInTheDocument()
  })
})
