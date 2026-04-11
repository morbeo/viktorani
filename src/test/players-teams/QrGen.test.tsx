// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/db'
import { isPlayerQrPayload, isTeamQrPayload } from '@/types/players-teams'
import type { PlayerQrPayload, TeamQrPayload } from '@/types/players-teams'
import PlayerQrModal from '@/components/players-teams/PlayerQrModal'
import TeamQrModal from '@/components/players-teams/TeamQrModal'
import PlayerList from '@/components/players-teams/PlayerList'
import TeamList from '@/components/players-teams/TeamList'

// qrcode.react renders SVG in jsdom — mock it to a simple div so we
// can test modal behaviour without needing a full SVG environment.
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr-svg" data-value={value} />,
}))

async function clearAll() {
  await Promise.all([db.managedPlayers.clear(), db.managedTeams.clear(), db.managedLabels.clear()])
}

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ── Type guards ───────────────────────────────────────────────────────────────

describe('QR payload type guards', () => {
  it('isPlayerQrPayload accepts a valid player payload', () => {
    const p: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'abc',
      name: 'Ana',
      labels: [],
    }
    expect(isPlayerQrPayload(p)).toBe(true)
  })

  it('isPlayerQrPayload rejects a team payload', () => {
    const t: TeamQrPayload = {
      type: 'viktorani/team/v1',
      id: 'abc',
      name: 'Blue',
      color: '#fff',
      icon: 'Shield',
      labels: [],
      players: [],
    }
    expect(isPlayerQrPayload(t)).toBe(false)
  })

  it('isTeamQrPayload accepts a valid team payload', () => {
    const t: TeamQrPayload = {
      type: 'viktorani/team/v1',
      id: 'abc',
      name: 'Blue',
      color: '#fff',
      icon: 'Shield',
      labels: [],
      players: [],
    }
    expect(isTeamQrPayload(t)).toBe(true)
  })

  it('isTeamQrPayload rejects null', () => {
    expect(isTeamQrPayload(null)).toBe(false)
  })
})

// ── PlayerQrModal ─────────────────────────────────────────────────────────────

describe('PlayerQrModal — payload', () => {
  beforeEach(clearAll)

  it('encodes correct type, id, and name in the QR value', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    const player = {
      id: 'p1',
      name: 'Ana Kovac',
      teamIds: [],
      labelIds: ['l1'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedPlayers.add(player)

    renderInRouter(<PlayerQrModal open player={player} onClose={() => {}} />)

    const svg = await screen.findByTestId('qr-svg')
    const payload = JSON.parse(svg.getAttribute('data-value') ?? '{}')

    expect(payload.type).toBe('viktorani/player/v1')
    expect(payload.id).toBe('p1')
    expect(payload.name).toBe('Ana Kovac')
    expect(payload.labels).toContain('Trivia')
  })

  it('uses label names not IDs in the payload', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Sports', color: '#e67e22' })
    const player = {
      id: 'p1',
      name: 'Ben',
      teamIds: [],
      labelIds: ['l1'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedPlayers.add(player)

    renderInRouter(<PlayerQrModal open player={player} onClose={() => {}} />)
    const svg = await screen.findByTestId('qr-svg')
    const payload = JSON.parse(svg.getAttribute('data-value') ?? '{}')

    expect(payload.labels).toEqual(['Sports'])
    expect(payload.labels).not.toContain('l1')
  })

  it('renders empty labels array when player has no labels', async () => {
    const player = {
      id: 'p1',
      name: 'Clara',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedPlayers.add(player)

    renderInRouter(<PlayerQrModal open player={player} onClose={() => {}} />)
    const svg = await screen.findByTestId('qr-svg')
    const payload = JSON.parse(svg.getAttribute('data-value') ?? '{}')

    expect(payload.labels).toEqual([])
  })

  it('shows modal title with player name', async () => {
    const player = {
      id: 'p1',
      name: 'Dave',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedPlayers.add(player)
    renderInRouter(<PlayerQrModal open player={player} onClose={() => {}} />)
    expect(await screen.findByText(/QR — Dave/i)).toBeInTheDocument()
  })

  it('renders nothing when player is null', () => {
    const { container } = renderInRouter(<PlayerQrModal open player={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})

// ── TeamQrModal ───────────────────────────────────────────────────────────────

describe('TeamQrModal — payload', () => {
  beforeEach(clearAll)

  it('encodes correct type, id, name, color, and icon', async () => {
    const team = {
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedTeams.add(team)

    renderInRouter(<TeamQrModal open team={team} onClose={() => {}} />)
    const svg = await screen.findByTestId('qr-svg')
    const payload = JSON.parse(svg.getAttribute('data-value') ?? '{}')

    expect(payload.type).toBe('viktorani/team/v1')
    expect(payload.id).toBe('t1')
    expect(payload.name).toBe('Blue Shield')
    expect(payload.color).toBe('#3a57b7')
    expect(payload.icon).toBe('Shield')
  })

  it('embeds active players as roster snapshot', async () => {
    await db.managedPlayers.bulkAdd([
      {
        id: 'p1',
        name: 'Ana',
        teamIds: ['t1'],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 'p2',
        name: 'Ben',
        teamIds: ['t1'],
        labelIds: [],
        archivedAt: new Date(),
        totalScore: 0,
        gameLog: [],
      },
    ])
    const team = {
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: ['p1', 'p2'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedTeams.add(team)

    renderInRouter(<TeamQrModal open team={team} onClose={() => {}} />)
    const svg = await screen.findByTestId('qr-svg')
    const payload = JSON.parse(svg.getAttribute('data-value') ?? '{}')

    // Only active player in snapshot
    expect(payload.players).toHaveLength(1)
    expect(payload.players[0]).toEqual({ id: 'p1', name: 'Ana' })
  })

  it('uses label names not IDs', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    const team = {
      id: 't1',
      name: 'Quiz Kings',
      color: '#3a57b7',
      icon: 'Trophy',
      labelIds: ['l1'],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedTeams.add(team)

    renderInRouter(<TeamQrModal open team={team} onClose={() => {}} />)
    const svg = await screen.findByTestId('qr-svg')
    const payload = JSON.parse(svg.getAttribute('data-value') ?? '{}')

    expect(payload.labels).toEqual(['Trivia'])
    expect(payload.labels).not.toContain('l1')
  })

  it('shows roster count in modal summary', async () => {
    await db.managedPlayers.bulkAdd([
      {
        id: 'p1',
        name: 'Ana',
        teamIds: ['t1'],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      {
        id: 'p2',
        name: 'Ben',
        teamIds: ['t1'],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
    ])
    const team = {
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: ['p1', 'p2'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    }
    await db.managedTeams.add(team)

    renderInRouter(<TeamQrModal open team={team} onClose={() => {}} />)
    expect(await screen.findByText(/2 players in roster snapshot/i)).toBeInTheDocument()
  })

  it('renders nothing when team is null', () => {
    const { container } = renderInRouter(<TeamQrModal open team={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})

// ── QR buttons in lists ───────────────────────────────────────────────────────

describe('PlayerList — QR button', () => {
  beforeEach(clearAll)

  it('shows a QR button on each active player row', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<PlayerList />)
    expect(await screen.findByRole('button', { name: /show qr for ana/i })).toBeInTheDocument()
  })

  it('opens PlayerQrModal when QR button is clicked', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<PlayerList />)
    fireEvent.click(await screen.findByRole('button', { name: /show qr for ana/i }))
    expect(await screen.findByText(/QR — Ana/i)).toBeInTheDocument()
  })
})

describe('TeamList — QR button', () => {
  beforeEach(clearAll)

  it('shows a QR button on each active team row', async () => {
    await db.managedTeams.add({
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<TeamList />)
    expect(
      await screen.findByRole('button', { name: /show qr for blue shield/i })
    ).toBeInTheDocument()
  })

  it('opens TeamQrModal when QR button is clicked', async () => {
    await db.managedTeams.add({
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    renderInRouter(<TeamList />)
    fireEvent.click(await screen.findByRole('button', { name: /show qr for blue shield/i }))
    expect(await screen.findByText(/QR — Blue Shield/i)).toBeInTheDocument()
  })
})
