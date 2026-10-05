import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HostVisibilityToggles } from '@/components/host/HostVisibilityToggles'
import type { Game } from '@/db'

const mockToggle = vi.fn()

const VISIBILITY = vi.hoisted(() => ({
  players: { showQuestion: true, showAnswers: false, showMedia: true },
  screen: { showQuestion: false, showAnswers: true, showMedia: true },
}))

vi.mock('@/hooks/useGameVisibility', () => ({
  useGameVisibility: vi.fn(() => ({
    visibility: VISIBILITY,
    toggle: mockToggle,
    saving: false,
    error: null,
  })),
}))

import { useGameVisibility } from '@/hooks/useGameVisibility'

const GAME: Game = {
  id: 'g1',
  name: 'Test',
  status: 'active',
  roomId: null,
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
  buzzDeduplication: 'firstOnly' as const,
  tiebreakerMode: 'serverOrder' as const,
  createdAt: 0,
  updatedAt: 0,
}

const defaultMock = {
  visibility: VISIBILITY,
  toggle: mockToggle,
  saving: false,
  error: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useGameVisibility).mockReturnValue(defaultMock)
})

describe('HostVisibilityToggles — rendering', () => {
  it('renders three switches per target', () => {
    render(<HostVisibilityToggles game={GAME} />)
    expect(screen.getAllByRole('switch')).toHaveLength(6)
    expect(screen.getByText('Player phones')).toBeInTheDocument()
    expect(screen.getByText('Screen')).toBeInTheDocument()
  })
  it('renders the three labels for each target', () => {
    render(<HostVisibilityToggles game={GAME} />)
    expect(screen.getAllByText('Show question')).toHaveLength(2)
    expect(screen.getAllByText('Show answers')).toHaveLength(2)
    expect(screen.getAllByText('Show media')).toHaveLength(2)
  })
  it('reflects aria-checked from each target', () => {
    render(<HostVisibilityToggles game={GAME} />)
    expect(screen.getByRole('switch', { name: 'Show question on player phones' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('switch', { name: 'Show question on screen' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
    expect(screen.getByRole('switch', { name: 'Show answers on screen' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })
})

describe('HostVisibilityToggles — interaction', () => {
  it.each([
    ['Show question on player phones', 'players', 'showQuestion'],
    ['Show answers on player phones', 'players', 'showAnswers'],
    ['Show media on screen', 'screen', 'showMedia'],
  ])('%s calls toggle(%s, %s)', async (name, target, key) => {
    render(<HostVisibilityToggles game={GAME} />)
    await userEvent.click(screen.getByRole('switch', { name }))
    expect(mockToggle).toHaveBeenCalledWith(target, key)
  })
  it('disables all switches while saving', () => {
    vi.mocked(useGameVisibility).mockReturnValue({
      visibility: VISIBILITY,
      toggle: mockToggle,
      saving: true,
      error: null,
    })
    render(<HostVisibilityToggles game={GAME} />)
    screen.getAllByRole('switch').forEach(sw => expect(sw).toBeDisabled())
  })
})

describe('HostVisibilityToggles — error state', () => {
  it('shows error message when error is set', () => {
    vi.mocked(useGameVisibility).mockReturnValue({
      visibility: VISIBILITY,
      toggle: mockToggle,
      saving: false,
      error: 'Failed to save visibility',
    })
    render(<HostVisibilityToggles game={GAME} />)
    expect(screen.getByText('Failed to save visibility')).toBeInTheDocument()
  })
  it('renders no error when error is null', () => {
    render(<HostVisibilityToggles game={GAME} />)
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })
})
