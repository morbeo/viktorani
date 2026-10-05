// @vitest-pool vmForks
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessagePanel } from '@/components/gamemaster/MessagePanel'
import type { Player, Team } from '@/db'

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    gameId: 'g1',
    name: id,
    teamId: null,
    score: 0,
    presence: 'connected',
    deviceId: `dev-${id}`,
    joinedAt: 0,
    notes: '',
    ...overrides,
  }
}

const TEAMS: Team[] = [
  { id: 't1', gameId: 'g1', name: 'Owls', color: '#000', icon: 'Shield', score: 0, notes: '' },
]
const PLAYERS = [player('Ann'), player('Bob', { presence: 'left' })]

function renderPanel(sent = 2) {
  const onSend = vi.fn(() => sent)
  render(<MessagePanel players={PLAYERS} teams={TEAMS} onSend={onSend} />)
  return onSend
}

describe('MessagePanel', () => {
  it('sends trimmed text to everyone by default and reports how many devices got it', async () => {
    const onSend = renderPanel()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Message'), '  Two minutes left  ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledWith({ kind: 'everyone' }, 'Two minutes left')
    expect(screen.getByRole('status')).toHaveTextContent('Sent to 2 devices.')
    expect(screen.getByLabelText('Message')).toHaveValue('')
  })

  it('offers teams and connected players only, and sends to the one picked', async () => {
    const onSend = renderPanel(1)
    const to = screen.getByLabelText('To')
    expect(screen.getByRole('option', { name: 'Owls' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ann' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Bob' })).toBeNull()

    await userEvent.selectOptions(to, 'Owls')
    await userEvent.type(screen.getByLabelText('Message'), 'Your turn')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenLastCalledWith({ kind: 'team', teamId: 't1' }, 'Your turn')

    await userEvent.selectOptions(to, 'Ann')
    await userEvent.type(screen.getByLabelText('Message'), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenLastCalledWith({ kind: 'player', playerId: 'Ann' }, 'Hi')
    expect(screen.getByRole('status')).toHaveTextContent('Sent to 1 device.')
  })

  it('keeps the text when nobody receives it', async () => {
    renderPanel(0)
    await userEvent.type(screen.getByLabelText('Message'), 'Hello?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('status')).toHaveTextContent('Nobody to send to.')
    expect(screen.getByLabelText('Message')).toHaveValue('Hello?')
  })

  it('clears the message everywhere', async () => {
    const onSend = renderPanel(3)
    await userEvent.click(screen.getByRole('button', { name: 'Clear everywhere' }))
    expect(onSend).toHaveBeenCalledWith({ kind: 'everyone' }, null)
    expect(screen.getByRole('status')).toHaveTextContent('Cleared on 3 devices.')
  })
})
