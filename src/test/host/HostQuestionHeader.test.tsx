import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HostQuestionHeader } from '@/components/host/HostQuestionHeader'
import type { Question, GameQuestion } from '@/db'

const BASE_Q: Question = {
  id: 'q1',
  title: 'What is the capital of France?',
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

const BASE_GQ: GameQuestion = {
  id: 'gq1',
  gameId: 'g1',
  questionId: 'q1',
  roundId: 'r1',
  order: 0,
  status: 'pending',
}

function q(o: Partial<Question> = {}): Question {
  return { ...BASE_Q, ...o }
}
function gq(o: Partial<GameQuestion> = {}): GameQuestion {
  return { ...BASE_GQ, ...o }
}

describe('HostQuestionHeader — title', () => {
  it('renders the question title', () => {
    render(<HostQuestionHeader question={q()} gameQuestion={gq()} />)
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()
  })
})

describe('HostQuestionHeader — type badge', () => {
  it('shows "Multiple choice" for multiple_choice', () => {
    render(<HostQuestionHeader question={q({ type: 'multiple_choice' })} gameQuestion={gq()} />)
    expect(screen.getByText('Multiple choice')).toBeInTheDocument()
  })
  it('shows "True / False" for true_false', () => {
    render(<HostQuestionHeader question={q({ type: 'true_false' })} gameQuestion={gq()} />)
    expect(screen.getByText('True / False')).toBeInTheDocument()
  })
  it('shows "Open ended" for open_ended', () => {
    render(<HostQuestionHeader question={q({ type: 'open_ended' })} gameQuestion={gq()} />)
    expect(screen.getByText('Open ended')).toBeInTheDocument()
  })
})

describe('HostQuestionHeader — status badge', () => {
  const cases: Array<[GameQuestion['status'], string, string]> = [
    ['pending', 'Pending', '#6b7280'],
    ['correct', 'Correct', '#16a34a'],
    ['incorrect', 'Incorrect', '#dc2626'],
    ['skipped', 'Skipped', '#d97706'],
  ]
  it.each(cases)('renders "%s" label and correct colour', (status, label, color) => {
    render(<HostQuestionHeader question={q()} gameQuestion={gq({ status })} />)
    const badge = screen.getByText(label)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ background: color })
  })
})
