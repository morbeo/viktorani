import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { CommandPaletteHost } from '@/components/command-palette/CommandPaletteHost'
import { ToastProvider } from '@/components/ui'
import {
  isPaletteShortcut,
  registerCommands,
  getPageCommands,
} from '@/components/command-palette/commands'

vi.mock('@/db', () => ({ db: {} }))
const loadDemo = vi.fn(async () => 'Demo Night')
vi.mock('@/lib/load-demo', () => ({ loadDemo: () => loadDemo() }))
// One record that serves as both a game (name) and a question (title)
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [{ id: 'x1', name: 'Pub night', title: 'Capital of France' }],
}))

function Where() {
  const { pathname, search } = useLocation()
  return <output data-testid="where">{pathname + search}</output>
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
        <CommandPaletteHost />
      </MemoryRouter>
    </ToastProvider>
  )
}

const ctrlK = () => fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

afterEach(cleanup)

describe('isPaletteShortcut', () => {
  it('matches Ctrl+K and ⌘+K only', () => {
    const k = (init: KeyboardEventInit) => isPaletteShortcut(new KeyboardEvent('keydown', init))
    expect(k({ key: 'k', ctrlKey: true })).toBe(true)
    expect(k({ key: 'K', metaKey: true })).toBe(true)
    expect(k({ key: 'k' })).toBe(false)
    expect(k({ key: 'k', ctrlKey: true, shiftKey: true })).toBe(false)
    expect(k({ key: 'j', ctrlKey: true })).toBe(false)
  })
})

describe('command registry', () => {
  it('adds and removes page commands', () => {
    const remove = registerCommands('t', [{ id: 'a', label: 'A', group: 'G', run: () => {} }])
    expect(getPageCommands().map(c => c.id)).toEqual(['a'])
    remove()
    expect(getPageCommands()).toEqual([])
  })
})

describe('CommandPaletteHost', () => {
  it('opens with Ctrl+K on admin pages and closes with Esc', async () => {
    renderAt('/admin')
    ctrlK()
    const input = await screen.findByRole('combobox', { name: 'Search commands' })
    expect(input).toHaveFocus()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('does nothing outside admin pages', () => {
    renderAt('/play')
    ctrlK()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('filters and runs a navigation command with the keyboard', async () => {
    renderAt('/admin')
    ctrlK()
    const input = await screen.findByRole('combobox')
    fireEvent.change(input, { target: { value: 'new quest' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('New question')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/questions?new=1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('finds games and questions by name', async () => {
    renderAt('/admin')
    ctrlK()
    const input = await screen.findByRole('combobox')
    fireEvent.change(input, { target: { value: 'capital' } })
    fireEvent.click(screen.getByRole('option', { name: /Capital of France/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/questions?edit=x1')
  })

  it('loads demo data', async () => {
    renderAt('/admin')
    ctrlK()
    const input = await screen.findByRole('combobox')
    fireEvent.change(input, { target: { value: 'demo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(loadDemo).toHaveBeenCalledOnce()
    expect(await screen.findByText(/Demo data loaded/)).toBeInTheDocument()
  })

  it('lists page commands first and moves the selection with the arrows', async () => {
    const run = vi.fn()
    const remove = registerCommands('page', [
      { id: 'p', label: 'Lock buzzer', group: 'Game', run },
    ])
    renderAt('/admin/game/g1')
    ctrlK()
    const input = await screen.findByRole('combobox')
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveTextContent('Lock buzzer')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(run).toHaveBeenCalledOnce()
    remove()
  })
})
