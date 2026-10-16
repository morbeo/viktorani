import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BuzzEvent, Game, Player, PlayerPresence, Team } from '@/db'
import {
  GamemasterBuzzOrderWidget,
  GamemasterGameControlsWidget,
  GamemasterPlayerListWidget,
} from '@/components/gamemaster/gamemaster-widgets'
import type { NavPosition } from '@/pages/admin/gamemaster-utils'
import type { GamemasterData } from '@/widgets/types'
import { WIDGET_REGISTRY } from '@/widgets/registry'

function buzz(id: string, playerName: string, receivedAt: number): BuzzEvent {
  return {
    id,
    gameId: 'g1',
    questionId: 'q1',
    playerId: `p-${id}`,
    playerName,
    teamId: null,
    timestamp: receivedAt,
    receivedAt,
    isFalseStart: false,
    gmDecision: null,
    decidedAt: null,
  }
}

function gmData(game: Partial<Game> = {}, rest: Partial<GamemasterData> = {}): GamemasterData {
  const buzzes = [buzz('b1', 'Ann', 1000), buzz('b2', 'Bob', 1250)]
  return {
    game: {
      id: 'g1',
      status: 'active',
      buzzerEnabled: true,
      buzzDeduplication: 'first',
      ...game,
    } as Game,
    buzzer: {
      buzzes,
      displayBuzzes: buzzes,
      onToggleLock: vi.fn(),
      onAdjudicate: vi.fn(),
      onClear: vi.fn(),
    },
    ...rest,
  } as GamemasterData
}

describe('GamemasterBuzzOrderWidget', () => {
  it('lists the buzzes in arrival order, without the lock or clear controls', () => {
    render(<GamemasterBuzzOrderWidget data={gmData()} config={{}} />)
    const queue = screen.getByRole('region', { name: 'Buzz order' })
    expect(queue).toHaveTextContent(/Ann.*first.*Bob.*\+250ms/)
    expect(screen.queryByRole('button', { name: /lock/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull()
  })

  it('judges a buzz', async () => {
    const data = gmData()
    render(<GamemasterBuzzOrderWidget data={data} config={{}} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Mark correct' })[0])
    expect(data.buzzer.onAdjudicate).toHaveBeenCalledWith('b1', 'Correct')
  })

  it('renders nothing when the game has no buzzer or has ended', () => {
    const { container, rerender } = render(
      <GamemasterBuzzOrderWidget data={gmData({ buzzerEnabled: false })} config={{}} />
    )
    expect(container).toBeEmptyDOMElement()
    rerender(<GamemasterBuzzOrderWidget data={gmData({ status: 'ended' })} config={{}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is registered for the game master', () => {
    expect(WIDGET_REGISTRY.buzz_order.components.gamemaster).toBe(GamemasterBuzzOrderWidget)
  })
})

describe('GamemasterPlayerListWidget', () => {
  const TEAMS = [{ id: 't1', name: 'Quizzly Bears', color: '#c0392b' }] as Team[]
  const player = (id: string, name: string, presence: PlayerPresence, teamId: string | null) =>
    ({ id, name, presence, teamId }) as Player

  it("lists who is still in the game, with each one's presence and team", () => {
    const players = [
      player('p1', 'Ann', 'connected', 't1'),
      player('p2', 'Bob', 'disconnected', null),
      player('p3', 'Cy', 'left', null),
      player('p4', 'Di', 'kicked', 't1'),
    ]
    render(<GamemasterPlayerListWidget data={gmData({}, { players, teams: TEAMS })} config={{}} />)
    const list = screen.getByRole('region', { name: /Players/ })
    expect(list).toHaveTextContent('Connected 1/2')
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map(r => r.textContent)).toEqual(['AnnQuizzly Bears', 'Bob'])
    expect(within(rows[0]).getByRole('img', { name: 'Connected' })).toBeInTheDocument()
    expect(within(rows[1]).getByRole('img', { name: 'Disconnected' })).toBeInTheDocument()
  })

  it('says so when nobody has joined', () => {
    render(<GamemasterPlayerListWidget data={gmData({}, { players: [], teams: [] })} config={{}} />)
    expect(screen.getByText('No players yet.')).toBeInTheDocument()
  })

  it('is registered for the game master', () => {
    expect(WIDGET_REGISTRY.player_list.components.gamemaster).toBe(GamemasterPlayerListWidget)
  })
})

describe('GamemasterGameControlsWidget', () => {
  const POS = { isFirst: false, isLast: false } as NavPosition

  function controls(game: Partial<Game> = {}, pos: Partial<NavPosition> = {}) {
    const data = gmData(game, {
      pos: { ...POS, ...pos },
      nav: { onPrev: vi.fn(), onNext: vi.fn() },
    })
    render(<GamemasterGameControlsWidget data={data} config={{}} />)
    return data
  }

  it('moves between questions and locks the buzzer', async () => {
    const data = controls()
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lock buzzer' }))
    expect(data.nav.onPrev).toHaveBeenCalledOnce()
    expect(data.nav.onNext).toHaveBeenCalledOnce()
    expect(data.buzzer.onToggleLock).toHaveBeenCalledOnce()
  })

  it('offers to unlock a locked buzzer', () => {
    controls({ buzzerLocked: true })
    expect(screen.getByRole('button', { name: 'Unlock buzzer' })).toBeInTheDocument()
  })

  it('disables the arrows at either end of the game', () => {
    controls({}, { isFirst: true, isLast: true })
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('leaves the lock out when the game has no buzzer', () => {
    controls({ buzzerEnabled: false })
    expect(screen.queryByRole('button', { name: /buzzer/ })).toBeNull()
  })

  it('renders nothing once the game has ended', () => {
    controls({ status: 'ended' })
    expect(screen.queryByRole('group', { name: 'Game controls' })).toBeNull()
  })

  it('is registered for the game master', () => {
    expect(WIDGET_REGISTRY.game_controls.components.gamemaster).toBe(GamemasterGameControlsWidget)
  })
})
