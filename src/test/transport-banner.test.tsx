import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransportBanner } from '@/components/gamemaster/TransportBanner'

describe('TransportBanner', () => {
  it('renders nothing while connected', () => {
    const { container } = render(
      <TransportBanner status="connected" error={null} retrying={null} onRetry={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('says the room is being retried', () => {
    render(<TransportBanner status="error" error="Oops." retrying={2} onRetry={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Opening the room… (retry 2)')
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('says the server is being reconnected while players stay connected', () => {
    render(<TransportBanner status="disconnected" error={null} retrying={null} onRetry={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('reconnecting')
  })

  it('explains a failure and offers a retry', async () => {
    const onRetry = vi.fn()
    render(
      <TransportBanner
        status="error"
        error="This room is already open in another tab or on another device."
        retrying={null}
        onRetry={onRetry}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Players cannot reach this game. This room is already open in another tab'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
