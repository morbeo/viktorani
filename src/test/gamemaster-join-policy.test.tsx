// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinPolicyPanel } from '@/components/gamemaster/JoinPolicyPanel'
import type { Game } from '@/db'

vi.mock('@/db', () => ({ db: { games: { update: vi.fn() } } }))

import { db } from '@/db'

const GAME: Game = {
  id: 'g1',
  name: 'Test',
  status: 'active',
  roomId: 'ABC',
  scoringEnabled: true,
  showQuestion: true,
  showAnswers: false,
  showMedia: true,
  maxTeams: 0,
  maxPerTeam: 0,
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

describe('JoinPolicyPanel', () => {
  it('reflects the game settings', () => {
    render(<JoinPolicyPanel game={GAME} onGameChange={vi.fn()} />)
    expect(screen.getByRole('switch', { name: 'Allow late join' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('switch', { name: 'Require approval' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('persists a toggle and reports the patch', async () => {
    const onGameChange = vi.fn()
    render(<JoinPolicyPanel game={GAME} onGameChange={onGameChange} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Require approval' }))
    expect(db.games.update).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ requireApproval: true })
    )
    expect(onGameChange).toHaveBeenCalledWith(expect.objectContaining({ requireApproval: true }))
  })

  it('shows an error and keeps the game unchanged when saving fails', async () => {
    vi.mocked(db.games.update).mockRejectedValue(new Error('disk full'))
    const onGameChange = vi.fn()
    render(<JoinPolicyPanel game={GAME} onGameChange={onGameChange} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Allow rejoin' }))
    expect(await screen.findByText('Could not save the join policy')).toBeInTheDocument()
    expect(onGameChange).not.toHaveBeenCalled()
  })
})
