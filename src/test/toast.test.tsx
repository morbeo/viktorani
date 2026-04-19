import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast, timerExpiredToast } from '@/components/ui'

// ── Helpers ───────────────────────────────────────────────────────────────────

function TestConsumer({
  message = 'Hello toast',
  variant = 'info' as const,
  durationMs = 0,
}: {
  message?: string
  variant?: 'info' | 'warning' | 'error'
  durationMs?: number
}) {
  const { addToast } = useToast()
  return <button onClick={() => addToast(message, { variant, durationMs })}>Add toast</button>
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

afterEach(() => {
  vi.useRealTimers()
})

// ── Render / dismiss ──────────────────────────────────────────────────────────

describe('ToastProvider / useToast', () => {
  it('renders a toast when addToast is called', async () => {
    const user = userEvent.setup()
    renderWithProvider(<TestConsumer message="Test message" />)

    await user.click(screen.getByRole('button', { name: 'Add toast' }))

    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('renders multiple toasts independently', async () => {
    const user = userEvent.setup()

    function MultiConsumer() {
      const { addToast } = useToast()
      return (
        <>
          <button onClick={() => addToast('First')}>Add first</button>
          <button onClick={() => addToast('Second')}>Add second</button>
        </>
      )
    }
    renderWithProvider(<MultiConsumer />)

    await user.click(screen.getByRole('button', { name: 'Add first' }))
    await user.click(screen.getByRole('button', { name: 'Add second' }))

    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('dismisses a toast when the dismiss button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProvider(<TestConsumer message="Dismissable" />)

    await user.click(screen.getByRole('button', { name: 'Add toast' }))
    expect(screen.getByText('Dismissable')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))

    await waitFor(() => {
      expect(screen.queryByText('Dismissable')).not.toBeInTheDocument()
    })
  })

  it('does not auto-dismiss when durationMs is 0', async () => {
    const user = userEvent.setup()
    renderWithProvider(<TestConsumer message="Stays forever" durationMs={0} />)
    await user.click(screen.getByRole('button', { name: 'Add toast' }))

    // Wait longer than any reasonable auto-dismiss would fire
    await new Promise(r => setTimeout(r, 300))

    expect(screen.getByText('Stays forever')).toBeInTheDocument()
  })

  it('auto-dismisses after durationMs elapses', async () => {
    const user = userEvent.setup()
    // Use a short real duration — fast enough for tests, longer than animation
    renderWithProvider(<TestConsumer message="Auto gone" durationMs={100} />)
    await user.click(screen.getByRole('button', { name: 'Add toast' }))

    expect(screen.getByText('Auto gone')).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByText('Auto gone')).not.toBeInTheDocument(), {
      timeout: 2000,
    })
  })

  it('uses role="status" for info toasts', async () => {
    const user = userEvent.setup()
    renderWithProvider(<TestConsumer message="Info toast" variant="info" />)
    await user.click(screen.getByRole('button', { name: 'Add toast' }))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('uses role="alert" for error toasts', async () => {
    const user = userEvent.setup()
    renderWithProvider(<TestConsumer message="Error toast" variant="error" />)
    await user.click(screen.getByRole('button', { name: 'Add toast' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('uses role="status" for warning toasts', async () => {
    const user = userEvent.setup()
    renderWithProvider(<TestConsumer message="Warning toast" variant="warning" />)
    await user.click(screen.getByRole('button', { name: 'Add toast' }))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('throws when useToast is called outside ToastProvider', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useToast must be used inside <ToastProvider>')
    err.mockRestore()
  })
})

// ── Lobby join event toast ────────────────────────────────────────────────────

describe('lobby join toast', () => {
  it('shows a player-joined toast message', async () => {
    const user = userEvent.setup()
    const playerName = 'Alex'

    function LobbyConsumer() {
      const { addToast } = useToast()
      return (
        <button
          onClick={() =>
            addToast(`${playerName} joined the lobby`, {
              variant: 'info',
              durationMs: 4000,
            })
          }
        >
          Simulate join
        </button>
      )
    }

    renderWithProvider(<LobbyConsumer />)
    await user.click(screen.getByRole('button', { name: 'Simulate join' }))

    expect(screen.getByText('Alex joined the lobby')).toBeInTheDocument()
  })
})

// ── timerExpiredToast helper ──────────────────────────────────────────────────

describe('timerExpiredToast', () => {
  it("shows time's up message with timer label", async () => {
    const user = userEvent.setup()

    function TimerConsumer() {
      const { addToast } = useToast()
      return <button onClick={() => timerExpiredToast(addToast, 'Round 1')}>Expire timer</button>
    }

    renderWithProvider(<TimerConsumer />)
    await user.click(screen.getByRole('button', { name: 'Expire timer' }))

    expect(screen.getByText("Time's up! — Round 1")).toBeInTheDocument()
  })

  it('shows generic message when label is "Timer"', async () => {
    const user = userEvent.setup()

    function TimerConsumer() {
      const { addToast } = useToast()
      return <button onClick={() => timerExpiredToast(addToast, 'Timer')}>Expire timer</button>
    }

    renderWithProvider(<TimerConsumer />)
    await user.click(screen.getByRole('button', { name: 'Expire timer' }))

    expect(screen.getByText("Time's up!")).toBeInTheDocument()
  })
})
