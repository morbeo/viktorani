// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db'
import type { GameQuestion, Player, Question } from '@/db'
import { ChoicePad, PlayerBuzzerWidget } from '@/pages/player/player-widgets'
import { PlayerQuestion } from '@/pages/player/PlayerQuestion'
import { HostAnswersPanel } from '@/components/host/HostAnswersPanel'
import type { PlayerData } from '@/widgets/types'
import type { QuestionContent } from '@/pages/player/player-session'

const QUESTION: Question = {
  id: 'q1',
  title: 'Capital of France?',
  type: 'multiple_choice',
  options: ['Lyon', 'Paris', 'Nice', 'Lille'],
  answer: 'Paris',
  description: '',
  difficulty: null,
  tags: [],
  media: null,
  mediaType: null,
  createdAt: 0,
  updatedAt: 0,
}

const GQ: GameQuestion = {
  id: 'gq1',
  gameId: 'g1',
  questionId: 'q1',
  roundId: 'r1',
  order: 0,
  status: 'pending',
  revealed: false,
}

const PLAYER: Player = {
  id: 'p1',
  gameId: 'g1',
  name: 'Alice',
  teamId: null,
  score: 0,
  presence: 'connected',
  disconnectedAt: null,
  deviceId: 'd',
  joinedAt: 1,
  notes: '',
}

describe('ChoicePad', () => {
  const pad = (props: Partial<NonNullable<PlayerData['choice']>> = {}) => ({
    count: 4,
    options: ['Lyon', 'Paris', 'Nice', 'Lille'],
    selected: null,
    enabled: true,
    onChoose: vi.fn(),
    ...props,
  })

  it('offers each option by letter and sends the one picked', async () => {
    const props = pad()
    render(<ChoicePad {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'B Paris' }))
    expect(props.onChoose).toHaveBeenCalledWith(1)
  })

  it('shows letters alone when the host hides the options', () => {
    render(<ChoicePad {...pad({ options: null, count: 2 })} />)
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['A', 'B'])
  })

  it('marks the pick and says it can still change', () => {
    render(<ChoicePad {...pad({ selected: 2 })} />)
    expect(screen.getByRole('button', { name: 'C Nice' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Answer C sent')
  })

  it('leaves only the pick once answers are closed', () => {
    render(<ChoicePad {...pad({ count: null, selected: 1 })} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Your answer: B · Paris')
  })

  it('disables the options while paused', () => {
    render(<ChoicePad {...pad({ enabled: false })} />)
    expect(screen.getByRole('button', { name: 'A Lyon' })).toBeDisabled()
  })
})

describe('PlayerBuzzerWidget', () => {
  const data = (overrides: Partial<PlayerData>): PlayerData => ({
    message: null,
    question: null,
    ended: false,
    buzzer: { enabled: true, label: 'BUZZ', onBuzz: vi.fn() },
    choice: null,
    ...overrides,
  })

  it('shows the options instead of the buzz button in a choice game', () => {
    const choice = { count: 2, options: null, selected: null, enabled: true, onChoose: vi.fn() }
    render(<PlayerBuzzerWidget data={data({ buzzer: null, choice })} config={{}} />)
    expect(screen.getByRole('region', { name: 'Your answer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buzz' })).toBeNull()
  })

  it('shows the buzz button otherwise', () => {
    render(<PlayerBuzzerWidget data={data({})} config={{}} />)
    expect(screen.getByRole('button', { name: 'Buzz' })).toBeInTheDocument()
  })
})

describe('PlayerQuestion', () => {
  const content = (choices: number | null): QuestionContent => ({
    type: 'QUESTION_CONTENT',
    target: 'players',
    questionId: 'q1',
    title: 'Capital of France?',
    description: null,
    options: ['Lyon', 'Paris'],
    answer: null,
    choices,
    media: null,
    mediaType: null,
  })

  it('leaves the options to the answer buttons while players pick one', () => {
    const { rerender } = render(<PlayerQuestion question={content(2)} />)
    expect(screen.queryByRole('list')).toBeNull()
    rerender(<PlayerQuestion question={content(null)} />)
    expect(screen.getByRole('list')).toHaveTextContent('Paris')
  })
})

describe('HostAnswersPanel', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map(t => t.clear()))
  })

  it('lists who picked what and marks them on request', async () => {
    await db.answers.add({
      id: 'a1',
      gameId: 'g1',
      gameQuestionId: 'gq1',
      playerId: 'p1',
      teamId: null,
      choice: 1,
      receivedAt: 1,
      ruling: 'pending',
    })
    const onMark = vi.fn()
    render(
      <HostAnswersPanel
        question={QUESTION}
        gameQuestion={GQ}
        players={[PLAYER]}
        teams={[]}
        onMark={onMark}
      />
    )
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('1 in')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mark answers' }))
    expect(onMark).toHaveBeenCalled()
  })

  it('shows each ruling once marked, with nothing left to mark', async () => {
    await db.answers.add({
      id: 'a1',
      gameId: 'g1',
      gameQuestionId: 'gq1',
      playerId: 'p1',
      teamId: null,
      choice: 0,
      receivedAt: 1,
      ruling: 'incorrect',
    })
    render(
      <HostAnswersPanel
        question={QUESTION}
        gameQuestion={GQ}
        players={[PLAYER]}
        teams={[]}
        onMark={vi.fn()}
      />
    )
    expect(await screen.findByText('Wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark answers' })).toBeDisabled()
  })

  it('says an open-ended question has to be ruled by hand', () => {
    const open = { ...QUESTION, type: 'open_ended' as const, options: [] }
    render(
      <HostAnswersPanel
        question={open}
        gameQuestion={GQ}
        players={[]}
        teams={[]}
        onMark={vi.fn()}
      />
    )
    expect(screen.getByText(/no options to pick from/)).toBeInTheDocument()
  })
})
