// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/db'
import { ToastProvider } from '@/components/ui'
import PlayersTeams from '@/pages/admin/PlayersTeams'

vi.mock('@/components/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

beforeEach(async () => {
  await Promise.all([db.managedPlayers.clear(), db.managedTeams.clear()])
})

function renderAt(path: string) {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <PlayersTeams />
      </MemoryRouter>
    </ToastProvider>
  )
}

const base = { labelIds: [], archivedAt: null, totalScore: 0, gameLog: [] }

describe('Players & Teams links', () => {
  it('opens the player from ?player=', async () => {
    await db.managedPlayers.add({ ...base, id: 'p1', name: 'Ann', teamIds: [] })
    renderAt('/admin/players-teams?player=p1')
    expect(await screen.findByRole('heading', { name: 'Edit player' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ann')).toBeInTheDocument()
  })

  it('opens the team from ?team=', async () => {
    await db.managedTeams.add({
      ...base,
      id: 't1',
      name: 'Owls',
      color: '#3a57b7',
      icon: '',
      playerIds: [],
    })
    renderAt('/admin/players-teams?team=t1')
    expect(await screen.findByRole('heading', { name: 'Edit team' })).toBeInTheDocument()
  })
})
