import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HostVisibilityToggles } from '@/components/host/HostVisibilityToggles'
import type { Game } from '@/db'

const mockToggle = vi.fn()

vi.mock('@/hooks/useGameVisibility', () => ({
  useGameVisibility: vi.fn(() => ({
    visibility: { showQuestion: true, showAnswers: false, showMedia: true },
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
  transportMode: 'auto',
  roomId: null,
  passphrase: null,
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

const defaultMock = {
  visibility: { showQuestion: true, showAnswers: false, showMedia: true },
  toggle: mockToggle,
  saving: false,
  error: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useGameVisibility).mockReturnValue(defaultMock)
})

describe('HostVisibilityToggles — rendering', () => {
  it('renders three toggle switches', () => {
    render(<HostVisibilityToggles game={GAME} />)
    expect(screen.getAllByRole('switch')).toHaveLength(3)
  })
  it('renders all three labels', () => {
    render(<HostVisibilityToggles game={GAME} />)
    expect(screen.getByText('Show question')).toBeInTheDocument()
    expect(screen.getByText('Show answers')).toBeInTheDocument()
    expect(screen.getByText('Show media')).toBeInTheDocument()
  })
  it('reflects aria-checked from visibility state', () => {
    render(<HostVisibilityToggles game={GAME} />)
    const [q, a, m] = screen.getAllByRole('switch')
    expect(q).toHaveAttribute('aria-checked', 'true')
    expect(a).toHaveAttribute('aria-checked', 'false')
    expect(m).toHaveAttribute('aria-checked', 'true')
  })
})

describe('HostVisibilityToggles — interaction', () => {
  it('calls toggle with showQuestion', async () => {
    render(<HostVisibilityToggles game={GAME} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Show question' }))
    expect(mockToggle).toHaveBeenCalledWith('showQuestion')
  })
  it('calls toggle with showAnswers', async () => {
    render(<HostVisibilityToggles game={GAME} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Show answers' }))
    expect(mockToggle).toHaveBeenCalledWith('showAnswers')
  })
  it('calls toggle with showMedia', async () => {
    render(<HostVisibilityToggles game={GAME} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Show media' }))
    expect(mockToggle).toHaveBeenCalledWith('showMedia')
  })
  it('disables all switches while saving', () => {
    vi.mocked(useGameVisibility).mockReturnValue({
      visibility: { showQuestion: true, showAnswers: false, showMedia: true },
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
      visibility: { showQuestion: true, showAnswers: false, showMedia: true },
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
