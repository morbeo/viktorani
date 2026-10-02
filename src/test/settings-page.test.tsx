import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Settings from '@/pages/admin/Settings'
import { getSettings } from '@/lib/app-settings'

vi.mock('@/components/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/settings/ManageTags', () => ({ default: () => <p>Tags list</p> }))
vi.mock('@/components/settings/ManageDifficulties', () => ({
  default: () => <p>Difficulties list</p>,
}))
vi.mock('@/components/players-teams/ManageLabels', () => ({ default: () => <p>Labels list</p> }))
vi.mock('@/components/settings/DataSettings', () => ({ default: () => <p>Data panel</p> }))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/settings" element={<Settings />} />
        <Route path="/admin/settings/:category" element={<Settings />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('Settings', () => {
  it('opens Appearance by default', () => {
    renderAt('/admin/settings')
    expect(screen.getByRole('link', { name: 'Appearance' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
  })

  it('deep-links to a category', () => {
    renderAt('/admin/settings/library')
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByText('Tags list')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Theme' })).not.toBeInTheDocument()
  })

  it('sends an unknown category to Appearance', () => {
    renderAt('/admin/settings/nope')
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
  })

  it('switches category from the tabs', async () => {
    renderAt('/admin/settings/appearance')
    await userEvent.click(screen.getByRole('link', { name: 'Data' }))
    expect(screen.getByText('Data panel')).toBeInTheDocument()
  })

  it('saves the theme and the control size to the settings store', async () => {
    renderAt('/admin/settings/appearance')
    await userEvent.click(screen.getByRole('button', { name: 'Always dark' }))
    await userEvent.click(screen.getByRole('button', { name: 'Large game master controls' }))
    expect(getSettings()).toEqual(expect.objectContaining({ theme: 'dark', controlSize: 'lg' }))
    expect(screen.getByRole('button', { name: 'Always dark' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('saves mute and volume from Sound & notifications', async () => {
    renderAt('/admin/settings/sound')
    const volume = screen.getByRole('slider', { name: 'Volume' })
    fireEvent.change(volume, { target: { value: '40' } })
    expect(getSettings().soundVolume).toBe(40)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mute all sounds' }))
    expect(getSettings().soundMuted).toBe(true)
    expect(volume).toBeDisabled()
  })

  it('saves the defaults for new timers', async () => {
    renderAt('/admin/settings/timers')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutes' }), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Seconds' }), {
      target: { value: '30' },
    })
    await userEvent.selectOptions(screen.getByLabelText('Auto-reset'), 'question')
    expect(getSettings()).toEqual(
      expect.objectContaining({ timerDuration: 150, timerAutoReset: 'question' })
    )
  })

  it('saves the delete confirmation and a valid join URL base from General', async () => {
    renderAt('/admin/settings/general')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Confirm destructive actions' }))
    expect(getSettings().confirmDestructive).toBe(false)

    const base = screen.getByLabelText('Player join URL base')
    fireEvent.change(base, { target: { value: 'ftp://lan' } })
    expect(base).toHaveAttribute('aria-invalid', 'true')
    expect(getSettings().joinUrlBase).toBe('')
    fireEvent.change(base, { target: { value: 'http://192.168.1.20:5173/' } })
    expect(base).toHaveAttribute('aria-invalid', 'false')
    expect(getSettings().joinUrlBase).toBe('http://192.168.1.20:5173/')
  })

  it('saves the defaults for new games', async () => {
    renderAt('/admin/settings/game-defaults')
    await userEvent.click(screen.getByRole('radio', { name: 'Pub quiz' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Scoring' }))
    expect(getSettings().gameDefaults).toEqual(
      expect.objectContaining({ scoringEnabled: false, maxPerTeam: 6, allowIndividual: false })
    )
    expect(screen.getByLabelText('Tiebreaker')).toHaveValue('serverOrder')
  })
})
