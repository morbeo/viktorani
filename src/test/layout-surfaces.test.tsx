import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Game, GameQuestion, Question } from '@/db'
import type { NavEntry, NavPosition } from '@/pages/admin/gamemaster-utils'
import type { UseTimerListResult } from '@/hooks/useTimer'
import type { GamemasterData, PlayerData } from '@/widgets/types'

// The host panels read the database; stand-ins show which widget rendered
vi.mock('@/components/host/HostQuestionPanel', () => ({
  HostQuestionPanel: ({ question }: { question: Question }) => <p>Host question {question.id}</p>,
}))
vi.mock('@/components/buzzer/BuzzerPanel', () => ({
  BuzzerPanel: ({ questionId }: { questionId: string | null }) => <p>Buzzer for {questionId}</p>,
}))
vi.mock('@/components/timer/TimerPanel', () => ({ TimerPanel: () => <p>Host timers</p> }))
vi.mock('@/components/timer/PlayerTimers', () => ({ PlayerTimers: () => <p>Player timers</p> }))

import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import { resolveLayout } from '@/widgets/layouts'

// ── Game master ──────────────────────────────────────────────────────────────

const SEQ: NavEntry[] = [
  {
    flatIndex: 0,
    roundIdx: 0,
    roundId: 'r1',
    roundName: 'Round 1',
    questionId: 'q1',
    gameQuestionId: 'gq1',
    questionStatus: 'pending',
  },
]

const POS: NavPosition = {
  flatIndex: 0,
  roundIdx: 0,
  questionIdx: 0,
  roundQuestions: 1,
  isFirst: true,
  isLast: true,
  isRoundBoundary: false,
}

function gmData(game: Partial<Game> = {}, rest: Partial<GamemasterData> = {}): GamemasterData {
  return {
    game: { id: 'g1', status: 'active', buzzerEnabled: true, ...game } as Game,
    onGameChange: vi.fn(),
    pos: POS,
    seq: SEQ,
    questionId: 'q1',
    question: { id: 'q1' } as Question,
    gameQuestion: { id: 'gq1', questionId: 'q1' } as GameQuestion,
    buzzer: {
      buzzes: [],
      displayBuzzes: [],
      onToggleLock: vi.fn(),
      onAdjudicate: vi.fn(),
      onClear: vi.fn(),
    },
    timers: {} as UseTimerListResult,
    players: [],
    teams: [],
    ...rest,
  }
}

function renderGm(data: GamemasterData) {
  const ended = data.game.status === 'ended'
  const bundle = resolveLayout([], {
    target: 'gamemaster',
    gameId: data.game.id,
    phase: ended ? 'ended' : null,
  })
  return render(<LayoutRenderer bundle={bundle} target="gamemaster" data={data} />)
}

const shown = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-widget]:not(:empty)')].map(
    c => c.dataset.widget
  )

describe('game master layout', () => {
  it('shows where the game is, the question, the buzzer and the timers', () => {
    const { container } = renderGm(gmData())
    expect(shown(container)).toEqual(['round_info', 'question', 'buzzer', 'timer'])
    expect(screen.getByText(/Round 1 · Q 1 of 1/)).toBeInTheDocument()
    expect(screen.getByText('Host question q1')).toBeInTheDocument()
    expect(screen.getByText('Buzzer for q1')).toBeInTheDocument()
    expect(screen.getByText('Host timers')).toBeInTheDocument()
  })

  it('leaves the question out while it loads', () => {
    const { container } = renderGm(gmData({}, { question: null, gameQuestion: null }))
    expect(shown(container)).toEqual(['round_info', 'buzzer', 'timer'])
  })

  it('leaves the buzzer out when the game has none', () => {
    const { container } = renderGm(gmData({ buzzerEnabled: false }))
    expect(shown(container)).toEqual(['round_info', 'question', 'timer'])
  })

  it('keeps only the position and the question once the game has ended', () => {
    const { container } = renderGm(gmData({ status: 'ended' }))
    expect(shown(container)).toEqual(['round_info', 'question'])
  })

  it('hides the buzzer and timers after the game ends even if a layout places them', () => {
    const bundle = resolveLayout([], { target: 'gamemaster', gameId: null, phase: null })
    const { container } = render(
      <LayoutRenderer bundle={bundle} target="gamemaster" data={gmData({ status: 'ended' })} />
    )
    expect(shown(container)).toEqual(['round_info', 'question'])
  })
})

// ── Player ───────────────────────────────────────────────────────────────────

function playerData(rest: Partial<PlayerData> = {}): PlayerData {
  return {
    message: { text: 'Drinks are on the house' },
    question: { type: 'QUESTION_CONTENT', title: 'Capital of France?' } as PlayerData['question'],
    ended: false,
    buzzer: { enabled: true, label: 'BUZZ', onBuzz: vi.fn() },
    ...rest,
  }
}

function renderPlayer(data: PlayerData) {
  const bundle = resolveLayout([], {
    target: 'player',
    gameId: null,
    phase: data.ended ? 'ended' : null,
  })
  return render(<LayoutRenderer bundle={bundle} target="player" data={data} breakpoint="phone" />)
}

describe('player layout', () => {
  it("shows the host's message, the question, the buzz button and the timers", () => {
    const { container } = renderPlayer(playerData())
    expect(shown(container)).toEqual(['announcement', 'question', 'buzzer', 'timer'])
    expect(screen.getByRole('status')).toHaveTextContent('Drinks are on the house')
    expect(screen.getByRole('heading', { name: 'Capital of France?' })).toBeInTheDocument()
    expect(screen.getByText('Player timers')).toBeInTheDocument()
  })

  it('buzzes through the button while it is enabled', async () => {
    const data = playerData()
    renderPlayer(data)
    await userEvent.click(screen.getByRole('button', { name: 'Buzz' }))
    expect(data.buzzer?.onBuzz).toHaveBeenCalledOnce()
  })

  it('shows a disabled button with the reason as its label', () => {
    renderPlayer(playerData({ buzzer: { enabled: false, label: 'Locked', onBuzz: vi.fn() } }))
    expect(screen.getByRole('button', { name: 'Buzz' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Buzz' })).toHaveTextContent('Locked')
  })

  it('leaves the button out when the game has no buzzer', () => {
    const { container } = renderPlayer(playerData({ buzzer: null }))
    expect(shown(container)).toEqual(['announcement', 'question', 'timer'])
  })

  it("keeps only the host's message once the game has ended", () => {
    const { container } = renderPlayer(playerData({ ended: true }))
    expect(shown(container)).toEqual(['announcement'])
  })

  it('hides the question, button and timers after the game ends even if a layout places them', () => {
    const bundle = resolveLayout([], { target: 'player', gameId: null, phase: null })
    const { container } = render(
      <LayoutRenderer bundle={bundle} target="player" data={playerData({ ended: true })} />
    )
    expect(shown(container)).toEqual(['announcement'])
  })
})
