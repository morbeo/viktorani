import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { parseRoundReview, readRoundReview, writeRoundReview } from '@/lib/round-review'
import { RoundReviewModal } from '@/components/gamemaster/RoundReviewModal'
import type { RoundReviewRow } from '@/components/gamemaster/RoundReviewModal'
import { RoundAnswersView } from '@/components/round-answers/RoundAnswersView'
import { ScreenView } from '@/components/screen/ScreenView'
import type { RoundAnswers } from '@/transport/types'
import type { Question } from '@/db'

beforeEach(() => localStorage.clear())

describe('round review store', () => {
  it('keeps one review per game and clears it', () => {
    writeRoundReview('g1', { roundId: 'r1', view: 'table' })
    expect(parseRoundReview(readRoundReview('g1'))).toEqual({ roundId: 'r1', view: 'table' })
    expect(readRoundReview('g2')).toBeNull()
    writeRoundReview('g1', null)
    expect(readRoundReview('g1')).toBeNull()
  })

  it.each(['', 'not json', '{"roundId":1,"view":"list"}', '{"roundId":"r","view":"grid"}'])(
    'ignores a stored value that is not a review: %s',
    stored => expect(parseRoundReview(stored)).toBeNull()
  )
})

function rows(...revealed: boolean[]): RoundReviewRow[] {
  return revealed.map((r, i) => ({
    gameQuestion: {
      id: `gq${i + 1}`,
      gameId: 'g1',
      questionId: `q${i + 1}`,
      roundId: 'r1',
      order: i,
      status: 'pending',
      revealed: r,
    },
    question: { id: `q${i + 1}`, title: `Question ${i + 1}`, answer: `A${i + 1}` } as Question,
  }))
}

function setup(props: Partial<Parameters<typeof RoundReviewModal>[0]> = {}) {
  const handlers = {
    onViewChange: vi.fn(),
    onReveal: vi.fn(),
    onClose: vi.fn(),
  }
  render(
    <RoundReviewModal
      roundName="Round 1"
      view="list"
      rows={rows(true, false, false)}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe('RoundReviewModal', () => {
  it('shows the host every answer, and reveals the next one in one-by-one view', async () => {
    const { onReveal } = setup()
    expect(screen.getByText('A3')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 revealed')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer 2' }))
    expect(onReveal).toHaveBeenCalledWith('gq2')
  })

  it('reveals every hidden answer at once in table view', async () => {
    const { onReveal } = setup({ view: 'table' })
    await userEvent.click(screen.getByRole('button', { name: 'Reveal all answers' }))
    expect(onReveal.mock.calls).toEqual([['gq2'], ['gq3']])
  })

  it('switches between the views', async () => {
    const { onViewChange } = setup()
    expect(screen.getByRole('button', { name: 'One by one' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(onViewChange).toHaveBeenCalledWith('table')
  })

  it('says when every answer is out, and offers Continue only on the way to the next round', async () => {
    const onContinue = vi.fn()
    setup({ rows: rows(true, true), onContinue })
    expect(screen.getByRole('button', { name: 'All answers revealed' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalled()
  })

  it('has no Continue when opened by hand', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
  })
})

const REVIEW: RoundAnswers = {
  roundName: 'Round 1',
  view: 'list',
  items: [
    {
      questionId: 'q1',
      number: 1,
      title: 'Capital of France?',
      answer: 'Paris',
      status: 'correct',
    },
    { questionId: 'q3', number: 3, title: null, answer: '<b>Rome</b>', status: 'incorrect' },
  ],
}

describe('RoundAnswersView', () => {
  it('lists the revealed answers as plain text', () => {
    const { container } = render(<RoundAnswersView review={REVIEW} size="phone" />)
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('<b>Rome</b>')).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
  })

  it('shows a table with each result', () => {
    render(<RoundAnswersView review={{ ...REVIEW, view: 'table' }} size="tv" />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Wrong')).toBeInTheDocument()
  })

  it('waits for the first answer', () => {
    render(<RoundAnswersView review={{ ...REVIEW, items: [] }} size="phone" />)
    expect(screen.getByText('Answers coming up…')).toBeInTheDocument()
  })

  it('takes over the screen while a review is open', () => {
    render(
      <ScreenView
        roundAnswers={REVIEW}
        data={{
          heading: 'Q1',
          content: null,
          message: null,
          rows: [],
          logEntries: [],
          timers: null,
        }}
      />
    )
    expect(screen.getByRole('region', { name: 'Round answers' })).toBeInTheDocument()
    expect(screen.queryByText('Q1')).toBeNull()
  })
})
