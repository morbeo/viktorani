import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DataSettings from '@/components/settings/DataSettings'

vi.mock('@/db', () => ({ purgeDatabase: vi.fn(), seedDefaults: vi.fn() }))
vi.mock('@/db/snapshot', () => ({ exportDatabase: vi.fn(), importDatabase: vi.fn() }))
vi.mock('@/lib/load-demo', () => ({ loadDemo: async () => 'Demo Night' }))

afterEach(() => {
  Reflect.deleteProperty(navigator, 'storage')
})

describe('DataSettings', () => {
  it('shows storage usage and whether it is persistent', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => ({ usage: 2048, quota: 10 * 1024 * 1024 }),
        persisted: async () => true,
      },
    })
    render(<DataSettings />)
    expect(await screen.findByText('2.0 KB of 10.0 MB')).toBeInTheDocument()
    expect(screen.getByText(/^Persistent/)).toBeInTheDocument()
  })

  it('reports storage as unavailable without the Storage API', async () => {
    render(<DataSettings />)
    expect(await screen.findByText('unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export JSON/ })).toBeInTheDocument()
  })

  it('loads demo data', async () => {
    render(<DataSettings />)
    fireEvent.click(screen.getByRole('button', { name: /Load demo data/ }))
    expect(
      await screen.findByText('Demo data loaded: open "Demo Night" in Games')
    ).toBeInTheDocument()
  })
})
