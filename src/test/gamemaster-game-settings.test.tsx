// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameSettingsDrawer } from '@/components/gamemaster/GameSettingsDrawer'
import type { Game } from '@/db'

import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { db } from '@/db'
import type { Layout } from '@/db'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'

/** The drawer links to the layout designer, so it renders inside a router. */
const inRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

const GAME: Game = {
  id: 'g1',
  name: 'Test',
  status: 'active',
  roomId: 'ABC',
  scoringEnabled: true,
  inputType: 'buzzer',
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
  rejoinWindowSeconds: 0,
  autoRemoveAfterMinutes: 0,
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
  confirmUnruledNavigation: false,
  autoAdvanceOnCorrect: false,
  autoAdvanceOnTimerExpiry: false,
  autoAdvanceDelaySeconds: 5,
  revealTiming: 'manual',
  answersClose: 'perQuestion',
  teamAnswering: 'anyone',
  rankTies: 'share',
  holdScores: false,
  scoresAnnouncedAt: null,
  autoStartTimerOnQuestionShow: false,
  defaultTimerDuration: 60,
  soundEffectsMuted: false,
  createdAt: 0,
  updatedAt: 0,
}

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.spyOn(db.games, 'update').mockResolvedValue(1)
  await Promise.all([db.layouts.clear(), db.widgets.clear()])
})

async function openDrawer(onGameChange = vi.fn()) {
  inRouter(<GameSettingsDrawer game={GAME} onGameChange={onGameChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Game settings' }))
  return onGameChange
}

describe('GameSettingsDrawer', () => {
  it('opens on demand and reflects the game settings', async () => {
    inRouter(<GameSettingsDrawer game={GAME} onGameChange={vi.fn()} />)
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

describe('GameLayoutsPanel in the drawer', () => {
  const layout = (id: string, gameId: string | null, name: string): Layout => ({
    id,
    gameId,
    name,
    target: 'screen',
    phase: null,
    theme: { ...DEFAULT_LAYOUT_THEME },
    isActive: true,
    order: 0,
  })

  it('chooses a layout for a surface and phase, and names what Automatic picks', async () => {
    await db.layouts.bulkPut([layout('own', 'g1', 'Big screen'), layout('tpl', null, 'Pub')])
    const onGameChange = await openDrawer()
    const panel = screen.getByRole('group', { name: 'Layouts' })

    // The game's own layout wins over the template
    const all = await within(panel).findByLabelText('All phases')
    expect(all).toHaveDisplayValue('Automatic: Big screen')
    const reveal = within(panel).getByLabelText('Reveal')
    await userEvent.selectOptions(reveal, 'Pub (template)')

    await waitFor(() =>
      expect(db.games.update).toHaveBeenCalledWith('g1', {
        layoutAssignments: { screen: { reveal: 'tpl' } },
        updatedAt: expect.any(Number),
      })
    )
    expect(onGameChange).toHaveBeenCalledWith(
      expect.objectContaining({ layoutAssignments: { screen: { reveal: 'tpl' } } })
    )
    expect(within(panel).getByRole('link', { name: "Edit this game's layouts" })).toHaveAttribute(
      'href',
      '/admin/layouts/g1'
    )
  })

  it('offers each surface its own layouts and the built-in defaults', async () => {
    await openDrawer()
    const panel = screen.getByRole('group', { name: 'Layouts' })
    await userEvent.selectOptions(within(panel).getByLabelText('Surface'), 'player')
    const options = within(await within(panel).findByLabelText('Game over')).getAllByRole('option')
    expect(options.map(o => o.textContent)).toEqual([
      'Automatic: Built-in default (Game over)',
      'Built-in default',
      'Built-in default (Game over)',
    ])
  })
})
