// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameSettingsDrawer } from '@/components/gamemaster/GameSettingsDrawer'
import type { Game } from '@/db'

vi.mock('@/db', () => ({ db: { games: { update: vi.fn() } } }))

import { db } from '@/db'

const GAME: Game = {
  id: 'g1',
  name: 'Test',
  status: 'active',
  roomId: 'ABC',
  scoringEnabled: true,
  buzzerEnabled: true,
  visibility: {
    players: { showQuestion: true, showAnswers: false, showMedia: true },
    screen: { showQuestion: true, showAnswers: false, showMedia: true },
  },
  maxTeams: 0,
  maxPerTeam: 0,
  maxPlayers: 0,
  allowIndividual: true,
  allowLateJoin: true,
  allowRejoin: true,
  requireApproval: false,
  allowPlayerTeams: true,
  roundIds: [],
  currentRoundIdx: 0,
  currentQuestionIdx: 0,
  buzzerLocked: false,
  autoLockOnFirstCorrect: false,
  allowFalseStarts: false,
  buzzDeduplication: 'firstOnly',
  tiebreakerMode: 'serverOrder',
  createdAt: 0,
  updatedAt: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.games.update).mockResolvedValue(1)
})

async function openDrawer(onGameChange = vi.fn()) {
  render(<GameSettingsDrawer game={GAME} onGameChange={onGameChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Game settings' }))
  return onGameChange
}

describe('GameSettingsDrawer', () => {
  it('opens on demand and reflects the game settings', async () => {
    render(<GameSettingsDrawer game={GAME} onGameChange={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Game settings' }))
    expect(screen.getByRole('dialog', { name: 'Game settings' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Allow late join' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('switch', { name: 'Require approval' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('shows scoring locked and leaves visibility to the question panel', async () => {
    await openDrawer()
    expect(screen.queryByRole('switch', { name: 'Scoring' })).not.toBeInTheDocument()
    expect(screen.getByText(/set when the game was created/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('persists a change and reports the patch', async () => {
    const onGameChange = await openDrawer()
    await userEvent.click(screen.getByRole('switch', { name: 'Require approval' }))
    expect(db.games.update).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ requireApproval: true })
    )
    expect(onGameChange).toHaveBeenCalledWith(expect.objectContaining({ requireApproval: true }))
  })

  it('applies a preset in one save', async () => {
    const onGameChange = await openDrawer()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Preset' }), 'Pub quiz')
    expect(db.games.update).toHaveBeenCalledTimes(1)
    expect(onGameChange).toHaveBeenCalledWith(
      expect.objectContaining({ allowIndividual: false, maxPerTeam: 6 })
    )
  })

  it('shows an error and keeps the game unchanged when saving fails', async () => {
    vi.mocked(db.games.update).mockRejectedValue(new Error('disk full'))
    const onGameChange = await openDrawer()
    await userEvent.click(screen.getByRole('switch', { name: 'Allow rejoin' }))
    expect(await screen.findByText('Could not save the game settings')).toBeInTheDocument()
    expect(onGameChange).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    await openDrawer()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
