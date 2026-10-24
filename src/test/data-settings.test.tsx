import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DataSettings from '@/components/settings/DataSettings'
import { purgeDatabase, seedDefaults } from '@/db'
import {
  applySnapshot,
  exportDatabase,
  importDatabase,
  previewReplace,
  readSnapshot,
} from '@/db/snapshot'
import type { ParsedSnapshot } from '@/db/snapshot'
import { loadDemo } from '@/lib/load-demo'

vi.mock('@/db', () => ({ purgeDatabase: vi.fn(), seedDefaults: vi.fn() }))
vi.mock('@/db/snapshot', () => ({
  exportDatabase: vi.fn(),
  importDatabase: vi.fn(),
  readSnapshot: vi.fn(async () => ({ tags: [] })),
  previewReplace: vi.fn(async () => []),
  applySnapshot: vi.fn(),
}))
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

function pickReplaceFile(file: File) {
  fireEvent.change(screen.getByLabelText('Replace from JSON'), { target: { files: [file] } })
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

  describe('replace from JSON', () => {
    const file = new File(['{}'], 'night.json', { type: 'application/json' })

    it('lists what will be removed and replaces only after confirming', async () => {
      vi.mocked(previewReplace).mockResolvedValueOnce([
        { table: 'questions', count: 7, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
        { table: 'games', count: 1, names: ['Old night'] },
        { table: 'gameQuestions', count: 4, names: [] },
      ])
      render(<DataSettings />)
      pickReplaceFile(file)
      expect(await screen.findByText('7 questions')).toBeInTheDocument()
      expect(screen.getByText(/A, B, C, D, E, and 2 more/)).toBeInTheDocument()
      expect(screen.getByText('1 game')).toBeInTheDocument()
      expect(screen.queryByText(/game questions/)).not.toBeInTheDocument()
      expect(screen.getByText(/scores and the log of removed games/)).toBeInTheDocument()
      expect(applySnapshot).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Replace data' }))
      expect(await screen.findByText('Data replaced from backup')).toBeInTheDocument()
      const parsed = await vi.mocked(readSnapshot).mock.results[0].value
      expect(applySnapshot).toHaveBeenCalledWith(parsed as ParsedSnapshot, 'replace')
      expect(screen.queryByRole('button', { name: 'Replace data' })).not.toBeInTheDocument()
    })

    it('says when nothing will be removed', async () => {
      render(<DataSettings />)
      pickReplaceFile(file)
      expect(await screen.findByText('Nothing will be removed.')).toBeInTheDocument()
    })

    it('writes nothing when cancelled', async () => {
      render(<DataSettings />)
      pickReplaceFile(file)
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
      expect(screen.queryByText('Nothing will be removed.')).not.toBeInTheDocument()
      expect(applySnapshot).not.toHaveBeenCalled()
    })

    it('reports an invalid file without opening the dialog', async () => {
      vi.mocked(readSnapshot).mockRejectedValueOnce(new Error('Invalid backup file: tags.0.id'))
      render(<DataSettings />)
      pickReplaceFile(file)
      expect(
        await screen.findByText('Import failed: Invalid backup file: tags.0.id')
      ).toBeInTheDocument()
      expect(previewReplace).not.toHaveBeenCalled()
    })

    it('reports a failed replace', async () => {
      vi.mocked(applySnapshot).mockRejectedValueOnce(new Error('Quota exceeded'))
      render(<DataSettings />)
      pickReplaceFile(file)
      fireEvent.click(await screen.findByRole('button', { name: 'Replace data' }))
      expect(await screen.findByText('Import failed: Quota exceeded')).toBeInTheDocument()
    })
  })
})
