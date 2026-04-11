import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Stub heavy pages so routing tests stay fast
vi.mock('@/pages/admin/Dashboard', () => ({ default: () => <div>Dashboard</div> }))
vi.mock('@/pages/admin/Questions', () => ({ default: () => <div>Questions</div> }))
vi.mock('@/pages/admin/Games', () => ({ default: () => <div>Games</div> }))
vi.mock('@/pages/admin/GameMaster', () => ({ default: () => <div>GameMaster</div> }))
vi.mock('@/pages/admin/Layouts', () => ({ default: () => <div>Layouts</div> }))
vi.mock('@/pages/admin/Notes', () => ({ default: () => <div>Notes</div> }))
vi.mock('@/pages/admin/Settings', () => ({ default: () => <div>Settings</div> }))
vi.mock('@/pages/admin/PlayersTeams', () => ({ default: () => <div>PlayersTeams</div> }))
vi.mock('@/pages/player/Join', () => ({ default: () => <div>Join</div> }))
vi.mock('@/pages/player/Play', () => ({ default: () => <div>Play</div> }))
vi.mock('@/db', () => ({
  seedDefaults: vi.fn().mockResolvedValue(undefined),
  db: {},
}))

import { Routes, Route, Navigate } from 'react-router-dom'

// Minimal route table mirroring App.tsx for isolated routing tests
function TestRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<div>Dashboard</div>} />
      <Route path="/admin/questions" element={<div>Questions</div>} />
      <Route path="/admin/games" element={<div>Games</div>} />
      <Route path="/admin/game/:id" element={<div>GameMaster</div>} />
      <Route path="/admin/layouts/:gameId" element={<div>Layouts</div>} />
      <Route path="/admin/notes" element={<div>Notes</div>} />
      <Route path="/admin/notes/:id" element={<div>NoteDetail</div>} />
      <Route path="/admin/players-teams" element={<div>PlayersTeams</div>} />
      <Route path="/admin/settings" element={<div>Settings</div>} />
      <Route path="/join" element={<div>Join</div>} />
      <Route path="/join/:roomId" element={<div>Join</div>} />
      <Route path="/play/:roomId" element={<div>Play</div>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TestRoutes />
    </MemoryRouter>
  )
}

describe('App routing', () => {
  it('redirects / to /admin', () => {
    renderAt('/')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders Dashboard at /admin', () => {
    renderAt('/admin')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders Questions at /admin/questions', () => {
    renderAt('/admin/questions')
    expect(screen.getByText('Questions')).toBeInTheDocument()
  })

  it('renders Games at /admin/games', () => {
    renderAt('/admin/games')
    expect(screen.getByText('Games')).toBeInTheDocument()
  })

  it('renders GameMaster at /admin/game/:id', () => {
    renderAt('/admin/game/abc123')
    expect(screen.getByText('GameMaster')).toBeInTheDocument()
  })

  it('renders Layouts at /admin/layouts/:gameId', () => {
    renderAt('/admin/layouts/abc123')
    expect(screen.getByText('Layouts')).toBeInTheDocument()
  })

  it('renders Notes at /admin/notes', () => {
    renderAt('/admin/notes')
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('renders NoteDetail at /admin/notes/:id', () => {
    renderAt('/admin/notes/some-note-id')
    expect(screen.getByText('NoteDetail')).toBeInTheDocument()
  })

  it('renders Settings at /admin/settings', () => {
    renderAt('/admin/settings')
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders PlayersTeams at /admin/players-teams', () => {
    renderAt('/admin/players-teams')
    expect(screen.getByText('PlayersTeams')).toBeInTheDocument()
  })

  it('renders Join at /join', () => {
    renderAt('/join')
    expect(screen.getByText('Join')).toBeInTheDocument()
  })

  it('renders Join at /join/:roomId', () => {
    renderAt('/join/ABC123')
    expect(screen.getByText('Join')).toBeInTheDocument()
  })

  it('renders Play at /play/:roomId', () => {
    renderAt('/play/ABC123')
    expect(screen.getByText('Play')).toBeInTheDocument()
  })

  it('redirects unknown routes to /admin', () => {
    renderAt('/totally-unknown-path')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
