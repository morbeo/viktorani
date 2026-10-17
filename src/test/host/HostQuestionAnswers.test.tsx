import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HostQuestionAnswers } from '@/components/host/HostQuestionAnswers'
import type { Question } from '@/db'

const BASE: Question = {
  id: 'q1',
  title: 'Q',
  type: 'multiple_choice',
  options: ['Paris', 'Lyon', 'Marseille', 'Nice'],
  answer: 'Paris',
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

describe('HostQuestionAnswers — multiple_choice', () => {
  it('renders all four options', () => {
    render(<HostQuestionAnswers question={q({})} />)
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('Lyon')).toBeInTheDocument()
    expect(screen.getByText('Marseille')).toBeInTheDocument()
    expect(screen.getByText('Nice')).toBeInTheDocument()
  })
  it('highlights the correct option with green background', () => {
    render(<HostQuestionAnswers question={q({})} />)
    expect(screen.getByText('Paris').closest('li')?.getAttribute('style')).toContain(
      '--color-positive'
    )
  })
  it('does not highlight incorrect options', () => {
    render(<HostQuestionAnswers question={q({})} />)
    expect(screen.getByText('Lyon').closest('li')?.getAttribute('style')).not.toContain(
      '--color-positive'
    )
  })
  it('shows "✓ Correct" marker only on the correct option', () => {
    render(<HostQuestionAnswers question={q({})} />)
    expect(screen.getAllByText('✓ Correct')).toHaveLength(1)
  })
  it('renders alphabetic labels A–D', () => {
    render(<HostQuestionAnswers question={q({})} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })
})

describe('HostQuestionAnswers — true_false', () => {
  const tf = q({ type: 'true_false', options: ['True', 'False'], answer: 'True' })
  it('renders True and False options', () => {
    render(<HostQuestionAnswers question={tf} />)
    expect(screen.getByText('True')).toBeInTheDocument()
    expect(screen.getByText('False')).toBeInTheDocument()
  })
  it('highlights True when answer is True', () => {
    render(<HostQuestionAnswers question={tf} />)
    expect(screen.getByText('True').closest('div')?.getAttribute('style')).toContain(
      '--color-positive'
    )
    expect(screen.getByText('False').closest('div')?.getAttribute('style')).not.toContain(
      '--color-positive'
    )
  })
  it('highlights False when answer is False', () => {
    render(
      <HostQuestionAnswers
        question={q({ type: 'true_false', options: ['True', 'False'], answer: 'False' })}
      />
    )
    expect(screen.getByText('False').closest('div')?.getAttribute('style')).toContain(
      '--color-positive'
    )
    expect(screen.getByText('True').closest('div')?.getAttribute('style')).not.toContain(
      '--color-positive'
    )
  })
})

describe('HostQuestionAnswers — open_ended', () => {
  const oe = q({ type: 'open_ended', options: [], answer: 'The Eiffel Tower' })
  it('renders the expected answer text', () => {
    render(<HostQuestionAnswers question={oe} />)
    expect(screen.getByText('The Eiffel Tower')).toBeInTheDocument()
  })
  it('renders the "Expected answer" label', () => {
    render(<HostQuestionAnswers question={oe} />)
    expect(screen.getByText('Expected answer')).toBeInTheDocument()
  })
})

describe('HostQuestionAnswers — section label', () => {
  it('renders "Answers" heading', () => {
    render(<HostQuestionAnswers question={q({})} />)
    expect(screen.getByText('Answers')).toBeInTheDocument()
  })
})
