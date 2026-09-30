// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui'
import DebugInfo from '@/components/settings/DebugInfo'

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

function renderAt(url: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[url]}>
        <DebugInfo />
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('DebugInfo', () => {
  beforeEach(() => localStorage.clear())

  it('is hidden by default', () => {
    renderAt('/admin/settings')
    expect(screen.queryByRole('heading', { name: 'Debug' })).not.toBeInTheDocument()
  })

  it('shows with ?debug=1 and stays visible afterwards', () => {
    const { unmount } = renderAt('/admin/settings?debug=1')
    expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument()
    expect(localStorage.getItem('viktorani:debug')).toBe('1')
    unmount()

    renderAt('/admin/settings')
    expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument()
  })

  it('hides with ?debug=0 and forgets the flag', () => {
    localStorage.setItem('viktorani:debug', '1')
    renderAt('/admin/settings?debug=0')
    expect(screen.queryByRole('heading', { name: 'Debug' })).not.toBeInTheDocument()
    expect(localStorage.getItem('viktorani:debug')).toBeNull()
  })

  it('renders build info with commit and run links', () => {
    renderAt('/admin/settings?debug=1')
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
})
