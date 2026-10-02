// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Games from '@/pages/admin/Games'
import { getSettings, setSettings } from '@/lib/app-settings'

vi.mock('@/components/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

beforeEach(() => {
  localStorage.clear()
})

describe('new-game wizard', () => {
  it('starts from the game defaults in settings', async () => {
    setSettings({ gameDefaults: { ...getSettings().gameDefaults, scoringEnabled: false } })
    render(
      <MemoryRouter initialEntries={['/admin/games?new=1']}>
        <Routes>
          <Route path="/admin/games" element={<Games />} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByRole('switch', { name: 'Scoring' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })
})
