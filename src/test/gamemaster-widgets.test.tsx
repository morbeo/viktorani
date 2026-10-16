import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BuzzEvent, Game } from '@/db'
import { GamemasterBuzzOrderWidget } from '@/components/gamemaster/gamemaster-widgets'
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
