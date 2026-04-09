import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HostQuestionPanel } from '@/components/host/HostQuestionPanel'
import type { Question, GameQuestion, Game } from '@/db'

vi.mock('@/db', () => ({ db: { games: { update: vi.fn() } } }))
vi.mock('@/transport', () => ({ transportManager: { send: vi.fn() } }))

import { db } from '@/db'
import { transportManager } from '@/transport'

const BASE_GAME: Game = {
  id: 'g1',
  name: 'Quiz Night',
  status: 'active',
  transportMode: 'auto',
  roomId: 'ABC123',
  passphrase: 'a-b-c-d',
  scoringEnabled: true,
  showQuestion: true,
  showAnswers: false,
  showMedia: true,
  maxTeams: 0,
  maxPerTeam: 0,
  allowIndividual: true,
  roundIds: [],
  currentRoundIdx: 0,
  currentQuestionIdx: 0,
  buzzerLocked: false,
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

function makeQ(o: Partial<Question> = {}): Question {
  return {
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
    ...o,
  }
}

function rp(question = makeQ(), gq = BASE_GQ, game = BASE_GAME) {
  return render(<HostQuestionPanel question={question} gameQuestion={gq} game={game} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.games.update).mockResolvedValue(1)
})

// ── Header ────────────────────────────────────────────────────────────────────

describe('HostQuestionPanel — header', () => {
  it('renders the question title', () => {
    rp()
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()
  })
  it('renders the type badge', () => {
    rp(makeQ({ type: 'true_false' }))
    expect(screen.getByText('True / False')).toBeInTheDocument()
  })
  it('renders the status badge', () => {
    rp(makeQ(), { ...BASE_GQ, status: 'correct' })
    expect(screen.getByText('Correct')).toBeInTheDocument()
  })
  it('host always sees title regardless of showQuestion flag', () => {
    rp(makeQ(), BASE_GQ, { ...BASE_GAME, showQuestion: false })
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()
  })
})

// ── Answers ───────────────────────────────────────────────────────────────────

describe('HostQuestionPanel — answers', () => {
  it('renders all options for multiple_choice', () => {
    rp()
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('Lyon')).toBeInTheDocument()
    expect(screen.getByText('Marseille')).toBeInTheDocument()
    expect(screen.getByText('Nice')).toBeInTheDocument()
  })
  it('highlights the correct answer', () => {
    rp()
    expect(screen.getByText('✓ Correct')).toBeInTheDocument()
  })
  it('renders True/False for true_false', () => {
    rp(makeQ({ type: 'true_false', options: ['True', 'False'], answer: 'True' }))
    expect(screen.getByText('True')).toBeInTheDocument()
    expect(screen.getByText('False')).toBeInTheDocument()
  })
  it('renders expected answer for open_ended', () => {
    rp(makeQ({ type: 'open_ended', options: [], answer: 'The Eiffel Tower' }))
    expect(screen.getByText('The Eiffel Tower')).toBeInTheDocument()
    expect(screen.getByText('Expected answer')).toBeInTheDocument()
  })
  it('host always sees answers regardless of showAnswers flag', () => {
    rp(makeQ(), BASE_GQ, { ...BASE_GAME, showAnswers: false })
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('✓ Correct')).toBeInTheDocument()
  })
})

// ── Media ─────────────────────────────────────────────────────────────────────

describe('HostQuestionPanel — media', () => {
  it('renders media when question has image', () => {
    rp(makeQ({ media: 'https://example.com/img.jpg', mediaType: 'image' }))
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
  it('does not render media section when media is null', () => {
    rp()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('audio')).not.toBeInTheDocument()
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })
  it('host always sees media regardless of showMedia flag', () => {
    rp(makeQ({ media: 'https://example.com/img.jpg', mediaType: 'image' }), BASE_GQ, {
      ...BASE_GAME,
      showMedia: false,
    })
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
})

// ── Visibility toggles ────────────────────────────────────────────────────────

describe('HostQuestionPanel — visibility toggles', () => {
  it('renders all three toggle switches', () => {
    rp()
    expect(screen.getAllByRole('switch')).toHaveLength(3)
  })
  it('reflects game visibility state in toggles', () => {
    rp(makeQ(), BASE_GQ, { ...BASE_GAME, showQuestion: false, showAnswers: true, showMedia: false })
    const [q, a, m] = screen.getAllByRole('switch')
    expect(q).toHaveAttribute('aria-checked', 'false')
    expect(a).toHaveAttribute('aria-checked', 'true')
    expect(m).toHaveAttribute('aria-checked', 'false')
  })
  it('persists to DB when a toggle is clicked', async () => {
    rp()
    await userEvent.click(screen.getByRole('switch', { name: 'Show answers' }))
    expect(db.games.update).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ showAnswers: true })
    )
  })
  it('emits VISIBILITY event with correct payload', async () => {
    rp()
    await userEvent.click(screen.getByRole('switch', { name: 'Show answers' }))
    expect(transportManager.send).toHaveBeenCalledWith({
      type: 'VISIBILITY',
      showQuestion: true,
      showAnswers: true,
      showMedia: true,
    })
  })
  it('shows error message if DB write fails', async () => {
    vi.mocked(db.games.update).mockRejectedValueOnce(new Error('Write failed'))
    rp()
    await userEvent.click(screen.getByRole('switch', { name: 'Show question' }))
    expect(screen.getByText('Write failed')).toBeInTheDocument()
  })
})

// ── Layout order ──────────────────────────────────────────────────────────────

describe('HostQuestionPanel — layout order', () => {
  it('renders header before answers before toggles', () => {
    rp()
    const title = screen.getByText('What is the capital of France?')
    const answers = screen.getByText('Answers')
    const toggles = screen.getByText('Visibility')
    expect(title.compareDocumentPosition(answers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(answers.compareDocumentPosition(toggles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// ── All question types ────────────────────────────────────────────────────────

describe('HostQuestionPanel — all question types render without error', () => {
  it('multiple_choice', () => {
    expect(() => rp()).not.toThrow()
  })
  it('true_false', () => {
    expect(() =>
      rp(makeQ({ type: 'true_false', options: ['True', 'False'], answer: 'False' }))
    ).not.toThrow()
  })
  it('open_ended', () => {
    expect(() => rp(makeQ({ type: 'open_ended', options: [], answer: 'Paris' }))).not.toThrow()
  })
})
