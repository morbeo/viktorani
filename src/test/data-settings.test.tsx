import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DataSettings from '@/components/settings/DataSettings'
import { purgeDatabase, seedDefaults } from '@/db'
import { exportDatabase, importDatabase } from '@/db/snapshot'
import { loadDemo } from '@/lib/load-demo'

vi.mock('@/db', () => ({ purgeDatabase: vi.fn(), seedDefaults: vi.fn() }))
vi.mock('@/db/snapshot', () => ({ exportDatabase: vi.fn(), importDatabase: vi.fn() }))
vi.mock('@/lib/load-demo', () => ({ loadDemo: vi.fn(async () => 'Demo Night') }))

afterEach(() => {
  Reflect.deleteProperty(navigator, 'storage')
  vi.clearAllMocks()
})

function pickFile(file: File | null) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input, { target: { files: file ? [file] : [] } })
  return input
}

// The confirm input's label has no htmlFor, so it is found by placeholder
async function openPurge() {
  render(<DataSettings />)
  fireEvent.click(screen.getByRole('button', { name: /^Purge$/ }))
  return screen.getByPlaceholderText('purge')
}

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

  it('says when storage may be cleared', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persisted: async () => false },
    })
    render(<DataSettings />)
    expect(await screen.findByText(/^Best effort/)).toBeInTheDocument()
    expect(screen.getByText('unavailable')).toBeInTheDocument()
  })

  it('keeps the defaults when the Storage API throws', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => {
          throw new Error('denied')
        },
      },
    })
    render(<DataSettings />)
    expect(await screen.findByText('unavailable')).toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('exports the database', () => {
    render(<DataSettings />)
    fireEvent.click(screen.getByRole('button', { name: /Export JSON/ }))
    expect(exportDatabase).toHaveBeenCalledTimes(1)
  })

  it('imports a backup file', async () => {
    render(<DataSettings />)
    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    pickFile(file)
    expect(await screen.findByText('Import successful')).toBeInTheDocument()
    expect(importDatabase).toHaveBeenCalledWith(file)
  })

  it('does nothing when no file is picked', () => {
    render(<DataSettings />)
    pickFile(null)
    expect(importDatabase).not.toHaveBeenCalled()
  })

  it('reports a failed import', async () => {
    vi.mocked(importDatabase).mockRejectedValueOnce(new Error('Bad file'))
    render(<DataSettings />)
    pickFile(new File(['x'], 'backup.json'))
    expect(await screen.findByText('Import failed: Bad file')).toBeInTheDocument()
  })

  it('reports a failed demo load', async () => {
    vi.mocked(loadDemo).mockRejectedValueOnce(new Error('Quota exceeded'))
    render(<DataSettings />)
    fireEvent.click(screen.getByRole('button', { name: /Load demo data/ }))
    expect(await screen.findByText('Demo data failed: Quota exceeded')).toBeInTheDocument()
  })

  it('only purges once "purge" is typed', async () => {
    const input = await openPurge()
    const confirm = screen.getByRole('button', { name: 'Purge all data' })
    expect(confirm).toBeDisabled()
    fireEvent.change(input, { target: { value: 'nope' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(purgeDatabase).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: ' PURGE ' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(await screen.findByText('Database purged and reset to defaults')).toBeInTheDocument()
    expect(purgeDatabase).toHaveBeenCalledTimes(1)
    expect(seedDefaults).toHaveBeenCalledTimes(1)
    expect(screen.queryByPlaceholderText('purge')).not.toBeInTheDocument()
  })

  it('purges on Enter', async () => {
    const input = await openPurge()
    fireEvent.change(input, { target: { value: 'purge' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Database purged and reset to defaults')).toBeInTheDocument()
  })

  it('reports a failed purge and keeps the dialog open', async () => {
    vi.mocked(purgeDatabase).mockRejectedValueOnce(new Error('Locked'))
    const input = await openPurge()
    fireEvent.change(input, { target: { value: 'purge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Purge all data' }))
    expect(await screen.findByText('Purge failed: Locked')).toBeInTheDocument()
    expect(seedDefaults).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('purge')).toBeInTheDocument()
  })

  it('clears the confirmation text when the dialog is cancelled', async () => {
    const input = await openPurge()
    fireEvent.change(input, { target: { value: 'purge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: /^Purge$/ }))
    expect(screen.getByPlaceholderText('purge')).toHaveValue('')
  })
})
