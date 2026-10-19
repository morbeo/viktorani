// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db'
import type { Answer, GameQuestion, Player, Question, Team } from '@/db'
import { RoundMarkingModal } from '@/components/gamemaster/RoundMarkingModal'
import type { RoundReviewRow } from '@/components/gamemaster/RoundReviewModal'

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    title: `Question ${id}`,
    type: 'open_ended',
    options: [],
    answer: 'Paris',
    description: '',
    difficulty: null,
    tags: [],
    media: null,
    mediaType: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function row(n: number, status: GameQuestion['status'], q: Question): RoundReviewRow {
  return {
    gameQuestion: {
      id: `gq${n}`,
      gameId: 'g1',
      questionId: q.id,
      roundId: 'r1',
      order: n,
      status,
      revealed: false,
    },
    question: q,
  }
}

function answer(overrides: Partial<Answer>): Answer {
  return {
    id: 'a',
    gameId: 'g1',
    gameQuestionId: 'gq1',
    playerId: 'p1',
    teamId: 't1',
    choice: null,
    text: null,
    receivedAt: 1,
    ruling: 'pending',
    ...overrides,
  }
}

const TEAMS: Team[] = [
  { id: 't1', gameId: 'g1', name: 'Owls', color: '#000', icon: 'Shield', score: 0, notes: '' },
  { id: 't2', gameId: 'g1', name: 'Bears', color: '#000', icon: 'Shield', score: 0, notes: '' },
]
const PLAYERS: Player[] = []

const ROWS = [
  row(1, 'incorrect', question('q1')),
  row(
    2,
    'pending',
    question('q2', { type: 'multiple_choice', options: ['Rome', 'Oslo'], answer: 'Oslo' })
  ),
]

function renderSheet(props: Partial<Parameters<typeof RoundMarkingModal>[0]> = {}) {
  const handlers = { onMarkTyped: vi.fn(), onCloseAnswers: vi.fn(), onClose: vi.fn() }
  render(
    <RoundMarkingModal
      roundName="Round 1"
      rows={ROWS}
      players={PLAYERS}
      teams={TEAMS}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

beforeEach(async () => {
  await db.answers.clear()
})

describe('RoundMarkingModal', () => {
  it('lays out who answered what, one row each, with their correct count', async () => {
    await db.answers.bulkAdd([
      answer({ id: 'a1', text: 'paris', ruling: 'correct' }),
      answer({ id: 'a2', gameQuestionId: 'gq2', choice: 1, ruling: 'correct' }),
      answer({ id: 'a3', teamId: 't2', playerId: 'p2', text: 'Lyon' }),
    ])
    renderSheet()

    const owls = await screen.findByRole('row', { name: /Owls/ })
    expect(within(owls).getByText('paris')).toBeInTheDocument()
    expect(within(owls).getByText('B Oslo')).toBeInTheDocument()
    expect(within(owls).getAllByRole('cell').at(-1)).toHaveTextContent('2')
    const bears = screen.getByRole('row', { name: /Bears/ })
    expect(within(bears).getByText('Lyon')).toBeInTheDocument()
    expect(within(bears).getByText('—')).toBeInTheDocument()
    expect(screen.getByText('1 to mark.')).toBeInTheDocument()
  })

  it('marks a typed answer, or every one matching the correct answer', async () => {
    await db.answers.bulkAdd([
      answer({ id: 'a1', text: ' PARIS ' }),
      answer({ id: 'a3', teamId: 't2', playerId: 'p2', text: 'Lyon' }),
    ])
    const { onMarkTyped } = renderSheet()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark Bears wrong on question 1' })
    )
    expect(onMarkTyped).toHaveBeenLastCalledWith(
      [expect.objectContaining({ id: 'a3' })],
      'incorrect'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Mark matching correct' }))
    expect(onMarkTyped).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'a1' })], 'correct')
  })

  it("closes the round's open questions", async () => {
    const { onCloseAnswers } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Close answers' }))
    expect(onCloseAnswers).toHaveBeenCalledWith(['gq2'])
  })

  it('says when nobody has answered', () => {
    renderSheet()
    expect(screen.getByText("Nobody has answered this round's questions yet.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark matching correct' })).toBeDisabled()
  })
})
