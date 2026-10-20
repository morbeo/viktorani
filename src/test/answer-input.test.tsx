// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db'
import type { GameQuestion, Player, Question } from '@/db'
import { ChoicePad, PlayerBuzzerWidget, TextPad } from '@/pages/player/player-widgets'
import { PlayerQuestion } from '@/pages/player/PlayerQuestion'
import { OpenQuestions } from '@/pages/player/OpenQuestions'
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

describe('TextPad', () => {
  const pad = (props: Partial<NonNullable<PlayerData['typed']>> = {}) => ({
    open: true,
    sent: null,
    enabled: true,
    onSend: vi.fn(),
    ...props,
  })

  it('sends the trimmed answer typed', async () => {
    const props = pad()
    render(<TextPad {...props} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Answer' }), '  Paris {Enter}')
    expect(props.onSend).toHaveBeenCalledWith('Paris')
    expect(screen.getByRole('textbox', { name: 'Answer' })).toHaveValue('')
  })

  it('sends nothing blank', async () => {
    const props = pad()
    render(<TextPad {...props} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Answer' }), '   ')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('says what was sent and that it can still change', () => {
    render(<TextPad {...pad({ sent: 'Paris' })} />)
    expect(screen.getByRole('status')).toHaveTextContent('Sent: Paris')
  })

  it('leaves only the sent answer once answers are closed', () => {
    render(<TextPad {...pad({ open: false, sent: 'Paris' })} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Your answer: Paris')
  })

  it('disables the box while paused', () => {
    render(<TextPad {...pad({ enabled: false })} />)
    expect(screen.getByRole('textbox', { name: 'Answer' })).toBeDisabled()
  })
})

describe('OpenQuestions', () => {
  const choiceItem = {
    questionId: 'q1',
    number: 1,
    title: 'Capital of France?',
    options: ['Lyon', 'Paris'],
    choices: 2,
    acceptsText: false,
  }
  const textItem = {
    questionId: 'q2',
    number: 2,
    title: null,
    options: null,
    choices: null,
    acceptsText: true,
  }

  it('shows nothing when no earlier question is open', () => {
    const { container } = render(
      <OpenQuestions questions={[]} sent={{}} enabled onChoose={vi.fn()} onSendText={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("answers each of the round's open questions by its id", async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    const onSendText = vi.fn()
    render(
      <OpenQuestions
        questions={[choiceItem, textItem]}
        sent={{ q1: { choice: 0 } }}
        enabled
        onChoose={onChoose}
        onSendText={onSendText}
      />
    )
    const first = screen.getByRole('region', { name: 'Question 1' })
    expect(within(first).getByText('Capital of France?')).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'A Lyon' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.click(within(first).getByRole('button', { name: 'B Paris' }))
    expect(onChoose).toHaveBeenCalledWith('q1', 1)

    // A hidden title falls back to the question's number
    const second = screen.getByRole('region', { name: 'Question 2' })
    expect(within(second).getAllByText('Question 2').length).toBeGreaterThan(0)
    await user.type(within(second).getByRole('textbox', { name: 'Answer' }), 'Rome{Enter}')
    expect(onSendText).toHaveBeenCalledWith('q2', 'Rome')
  })
})

describe('PlayerBuzzerWidget', () => {
  const data = (overrides: Partial<PlayerData>): PlayerData => ({
    message: null,
    question: null,
    ended: false,
    buzzer: { enabled: true, label: 'BUZZ', onBuzz: vi.fn() },
    choice: null,
    typed: null,
    ...overrides,
  })

  it('shows the options instead of the buzz button in a choice game', () => {
    const choice = { count: 2, options: null, selected: null, enabled: true, onChoose: vi.fn() }
    render(<PlayerBuzzerWidget data={data({ buzzer: null, choice })} config={{}} />)
    expect(screen.getByRole('region', { name: 'Your answer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buzz' })).toBeNull()
  })

  it('shows the answer box instead of the buzz button in a typed game', () => {
    const typed = { open: true, sent: null, enabled: true, onSend: vi.fn() }
    render(<PlayerBuzzerWidget data={data({ buzzer: null, typed })} config={{}} />)
    expect(screen.getByRole('textbox', { name: 'Answer' })).toBeInTheDocument()
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
    acceptsText: false,
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
      text: null,
      receivedAt: 1,
      ruling: 'pending',
    })
    const onMark = vi.fn()
    render(
      <HostAnswersPanel
        inputType="choice"
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
      text: null,
      receivedAt: 1,
      ruling: 'incorrect',
    })
    render(
      <HostAnswersPanel
        inputType="choice"
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
        inputType="choice"
        question={open}
        gameQuestion={GQ}
        players={[]}
        teams={[]}
        onMark={vi.fn()}
      />
    )
    expect(screen.getByText(/no options to pick from/)).toBeInTheDocument()
  })

  it('lets the host mark typed answers one by one or all that match', async () => {
    const typedAnswer = (id: string, playerId: string, text: string) => ({
      id,
      gameId: 'g1',
      gameQuestionId: 'gq1',
      playerId,
      teamId: null,
      choice: null,
      text,
      receivedAt: 1,
      ruling: 'pending' as const,
    })
    await db.answers.bulkAdd([typedAnswer('a1', 'p1', 'paris'), typedAnswer('a2', 'p2', 'Lyon')])
    const onMarkTyped = vi.fn()
    const onMark = vi.fn()
    render(
      <HostAnswersPanel
        inputType="text"
        question={{ ...QUESTION, type: 'open_ended', options: [] }}
        gameQuestion={GQ}
        players={[PLAYER, { ...PLAYER, id: 'p2', name: 'Bob' }]}
        teams={[]}
        onMark={onMark}
        onMarkTyped={onMarkTyped}
      />
    )
    expect(await screen.findByText('paris')).toBeInTheDocument()
    expect(
      screen.getByText('2 to mark. Players can still change their answers.')
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mark Bob wrong' }))
    expect(onMarkTyped).toHaveBeenLastCalledWith(
      [expect.objectContaining({ id: 'a2' })],
      'incorrect'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Mark matching correct' }))
    expect(onMarkTyped).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'a1' })], 'correct')
    await userEvent.click(screen.getByRole('button', { name: 'Close answers' }))
    expect(onMark).toHaveBeenCalled()
  })

  it('shows marks on typed answers, with nothing to close on a closed question', async () => {
    await db.answers.add({
      id: 'a1',
      gameId: 'g1',
      gameQuestionId: 'gq1',
      playerId: 'p1',
      teamId: null,
      choice: null,
      text: 'Paris',
      receivedAt: 1,
      ruling: 'correct',
    })
    render(
      <HostAnswersPanel
        inputType="text"
        question={QUESTION}
        gameQuestion={{ ...GQ, status: 'correct' }}
        players={[PLAYER]}
        teams={[]}
        onMark={vi.fn()}
        onMarkTyped={vi.fn()}
      />
    )
    expect(await screen.findByRole('button', { name: 'Mark Alice correct' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Close answers' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mark matching correct' })).toBeDisabled()
  })
})
