// @vitest-pool vmForks
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PendingJoinsPanel } from '@/components/gamemaster/PendingJoinsPanel'

const PENDING = [
  {
    connId: 'dc1',
    join: {
      type: 'JOIN' as const,
      playerName: 'Alice',
      deviceId: 'dev-a',
      teamId: null,
      newTeamName: 'Owls',
    },
  },
]

describe('PendingJoinsPanel', () => {
  it('renders nothing when no one is waiting', () => {
    const { container } = render(
      <PendingJoinsPanel pending={[]} onApprove={vi.fn()} onReject={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('lists waiting players and reports approve and reject by connection', async () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(<PendingJoinsPanel pending={PENDING} onApprove={onApprove} onReject={onReject} />)
    expect(screen.getByText('Waiting for approval (1)')).toBeInTheDocument()
    expect(screen.getByText('new team: Owls')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Approve Alice' }))
    expect(onApprove).toHaveBeenCalledWith('dc1')
    await userEvent.click(screen.getByRole('button', { name: 'Reject Alice' }))
    expect(onReject).toHaveBeenCalledWith('dc1')
  })
})
