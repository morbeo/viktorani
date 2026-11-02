// @vitest-pool vmForks
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudioPanel } from '@/components/gamemaster/StudioPanel'
import type { StudioState } from '@/lib/studio'

const GAME = { id: 'g1', layoutAssignments: undefined }

function renderPanel(studio: StudioState | null, live: 'question' | 'scoreboard' = 'question') {
  const onStudio = vi.fn()
  render(<StudioPanel game={GAME} layouts={[]} live={live} studio={studio} onStudio={onStudio} />)
  return onStudio
}

describe('StudioPanel', () => {
  it('is off by default, and turning it on keeps what the screens show', async () => {
    const onStudio = renderPanel(null)
    const toggle = screen.getByRole('switch', { name: 'Studio mode' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('button', { name: 'Cut' })).toBeNull()
    await userEvent.click(toggle)
    expect(onStudio).toHaveBeenCalledWith({ program: 'question', transition: 'cut' })
  })

  it('shows the layout on screen and the next one, and takes it with a cut or a fade', async () => {
    const onStudio = renderPanel({ program: 'scoreboard', transition: 'cut' })
    expect(screen.getByText(/On screen:/)).toHaveTextContent('On screen: Scoreboard')
    expect(screen.getByText(/Next:/)).toHaveTextContent('Next: Question')
    await userEvent.click(screen.getByRole('button', { name: 'Cut' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fade' }))
    expect(onStudio.mock.calls).toEqual([
      [{ program: 'question', transition: 'cut' }],
      [{ program: 'question', transition: 'fade' }],
    ])
    await userEvent.click(screen.getByRole('switch', { name: 'Studio mode' }))
    expect(onStudio).toHaveBeenLastCalledWith(null)
  })

  it('has nothing to take when the next layout is the one on screen', () => {
    renderPanel({ program: 'scoreboard', transition: 'fade' }, 'scoreboard')
    expect(screen.getByRole('button', { name: 'Cut' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fade' })).toBeDisabled()
  })
})
