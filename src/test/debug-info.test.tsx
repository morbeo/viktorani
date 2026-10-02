// @vitest-pool vmForks
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui'
import AdminLayout from '@/components/AdminLayout'
import DebugInfo from '@/components/DebugInfo'

vi.mock('@/buildInfo', () => ({
  buildInfo: {
    version: '9.8.7',
    commit: 'abcdef1234567890',
    builtAt: '2026-01-02T03:04:05.000Z',
    runId: '424242',
    runNumber: '17',
    ref: 'master',
  },
}))

const seedDemo = vi.fn(async () => {})
vi.mock('@/db/demo', () => ({ seedDemo: () => seedDemo(), DEMO_GAME_NAME: 'Demo Night' }))

function renderPanel() {
  return render(
    <ToastProvider>
      <DebugInfo />
    </ToastProvider>
  )
}

describe('DebugInfo', () => {
  it('renders build info with commit and run links', () => {
    renderPanel()
    expect(screen.getByText('9.8.7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'abcdef1' })).toHaveAttribute(
      'href',
      'https://github.com/morbeo/viktorani/commit/abcdef1234567890'
    )
    expect(screen.getByRole('link', { name: '#17 (424242)' })).toHaveAttribute(
      'href',
      'https://github.com/morbeo/viktorani/actions/runs/424242'
    )
  })

  it('copies the info as text', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /copy/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    expect(writeText.mock.calls[0]).toEqual([expect.stringContaining('Version: 9.8.7')])
    expect(await screen.findByText('Debug info copied')).toBeInTheDocument()
  })

  it('loads demo data from the panel', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /load demo data/i }))
    await waitFor(() => expect(seedDemo).toHaveBeenCalledOnce())
    expect(await screen.findByText(/Demo data loaded/)).toBeInTheDocument()
  })
})

describe('sidebar version entry', () => {
  it('shows the version and opens the debug page', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout>Dashboard</AdminLayout>} />
          <Route path="/admin/debug" element={<p>Debug page</p>} />
        </Routes>
      </MemoryRouter>
    )
    const entry = screen.getByRole('link', { name: 'Debug info, v9.8.7 · abcdef1' })
    expect(entry).toHaveTextContent('v9.8.7 · abcdef1')

    fireEvent.click(entry)

    expect(screen.getByText('Debug page')).toBeInTheDocument()
  })
})
