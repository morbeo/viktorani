// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/db'
import {
  detectPlayerConflict,
  importPlayerDirect,
  applyPlayerMerge,
  importTeamQr,
  resolveOrCreateLabels,
} from '@/components/players-teams/qrImport'
import type { PlayerQrPayload, TeamQrPayload } from '@/types/players-teams'
import PlayerMergeModal from '@/components/players-teams/PlayerMergeModal'

async function clearAll() {
  await Promise.all([db.managedPlayers.clear(), db.managedTeams.clear(), db.managedLabels.clear()])
}

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ── resolveOrCreateLabels ─────────────────────────────────────────────────────

describe('resolveOrCreateLabels', () => {
  beforeEach(clearAll)

  it('returns empty array for empty input', async () => {
    expect(await resolveOrCreateLabels([])).toEqual([])
  })

  it('creates a label that does not exist and returns its ID', async () => {
    const ids = await resolveOrCreateLabels(['Trivia'])
    expect(ids).toHaveLength(1)
    const label = await db.managedLabels.get(ids[0])
    expect(label?.name).toBe('Trivia')
  })

  it('reuses an existing label by name (case-insensitive)', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Trivia', color: '#6366f1' })
    const ids = await resolveOrCreateLabels(['trivia'])
    expect(ids).toEqual(['l1'])
    expect(await db.managedLabels.count()).toBe(1) // no new label created
  })

  it('handles a mix of existing and new labels', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Sports', color: '#e67e22' })
    const ids = await resolveOrCreateLabels(['Sports', 'NewLabel'])
    expect(ids).toContain('l1')
    expect(ids).toHaveLength(2)
    expect(await db.managedLabels.count()).toBe(2)
  })
})

// ── detectPlayerConflict ──────────────────────────────────────────────────────

describe('detectPlayerConflict', () => {
  beforeEach(clearAll)

  it('returns null when no existing player matches', async () => {
    const payload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'p-new',
      name: 'Ana',
      labels: [],
    }
    expect(await detectPlayerConflict(payload)).toBeNull()
  })

  it('detects conflict by ID', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const payload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Ana',
      labels: [],
    }
    const conflict = await detectPlayerConflict(payload)
    expect(conflict).not.toBeNull()
    expect(conflict!.existing.id).toBe('p1')
  })

  it('detects conflict by name (case-insensitive)', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana Kovac',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const payload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'p-other',
      name: 'ana kovac',
      labels: [],
    }
    const conflict = await detectPlayerConflict(payload)
    expect(conflict).not.toBeNull()
  })

  it('includes name diff when names differ', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const payload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Ana K.',
      labels: [],
    }
    const conflict = await detectPlayerConflict(payload)
    expect(conflict!.diffs.some(d => d.field === 'name')).toBe(true)
  })

  it('includes labels diff when labels differ', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Sports', color: '#e67e22' })
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ben',
      teamIds: [],
      labelIds: ['l1'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const payload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Ben',
      labels: ['Trivia'],
    }
    const conflict = await detectPlayerConflict(payload)
    expect(conflict!.diffs.some(d => d.field === 'labels')).toBe(true)
  })

  it('returns empty diffs when records are identical', async () => {
    await db.managedLabels.add({ id: 'l1', name: 'Sports', color: '#e67e22' })
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ben',
      teamIds: [],
      labelIds: ['l1'],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const payload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Ben',
      labels: ['Sports'],
    }
    const conflict = await detectPlayerConflict(payload)
    expect(conflict!.diffs).toHaveLength(0)
  })
})

// ── importPlayerDirect ────────────────────────────────────────────────────────

describe('importPlayerDirect', () => {
  beforeEach(clearAll)

  it('creates a new player with no labels', async () => {
    const payload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Clara',
      labels: [],
    }
    const id = await importPlayerDirect(payload)
    const player = await db.managedPlayers.get(id)
    expect(player?.name).toBe('Clara')
    expect(player?.labelIds).toHaveLength(0)
    expect(player?.archivedAt).toBeNull()
  })

  it('creates labels that do not exist and assigns them', async () => {
    const payload: PlayerQrPayload = {
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Dave',
      labels: ['Trivia'],
    }
    const id = await importPlayerDirect(payload)
    const player = await db.managedPlayers.get(id)
    expect(player?.labelIds).toHaveLength(1)
    const label = await db.managedLabels.get(player!.labelIds[0])
    expect(label?.name).toBe('Trivia')
  })
})

// ── applyPlayerMerge ──────────────────────────────────────────────────────────

describe('applyPlayerMerge', () => {
  beforeEach(clearAll)

  it('keeps current name when choice is current', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const conflict = (await detectPlayerConflict({
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Ana K.',
      labels: [],
    }))!
    await applyPlayerMerge(conflict, { name: 'current', labels: 'current' })
    const player = await db.managedPlayers.get('p1')
    expect(player?.name).toBe('Ana')
  })

  it('updates name when choice is incoming', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const conflict = (await detectPlayerConflict({
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Ana K.',
      labels: [],
    }))!
    await applyPlayerMerge(conflict, { name: 'incoming', labels: 'current' })
    const player = await db.managedPlayers.get('p1')
    expect(player?.name).toBe('Ana K.')
  })

  it('updates labels when choice is incoming', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ben',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const conflict = (await detectPlayerConflict({
      type: 'viktorani/player/v1',
      id: 'p1',
      name: 'Ben',
      labels: ['Trivia'],
    }))!
    await applyPlayerMerge(conflict, { name: 'current', labels: 'incoming' })
    const player = await db.managedPlayers.get('p1')
    expect(player?.labelIds).toHaveLength(1)
  })
})

// ── importTeamQr ──────────────────────────────────────────────────────────────

describe('importTeamQr', () => {
  beforeEach(clearAll)

  it('creates a new team with no players', async () => {
    const payload: TeamQrPayload = {
      type: 'viktorani/team/v1',
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labels: [],
      players: [],
    }
    const result = await importTeamQr(payload)
    expect(result.teamId).toBe('t1')
    const team = await db.managedTeams.get('t1')
    expect(team?.name).toBe('Blue Shield')
  })

  it('imports embedded players and links them to the team', async () => {
    const payload: TeamQrPayload = {
      type: 'viktorani/team/v1',
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labels: [],
      players: [
        { id: 'p1', name: 'Ana' },
        { id: 'p2', name: 'Ben' },
      ],
    }
    const result = await importTeamQr(payload)
    expect(result.createdPlayerIds).toHaveLength(2)
    const team = await db.managedTeams.get('t1')
    expect(team?.playerIds).toContain('p1')
    expect(team?.playerIds).toContain('p2')
  })

  it('detects conflict for an existing player in the roster', async () => {
    await db.managedPlayers.add({
      id: 'p1',
      name: 'Ana',
      teamIds: [],
      labelIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const payload: TeamQrPayload = {
      type: 'viktorani/team/v1',
      id: 't1',
      name: 'Blue Shield',
      color: '#3a57b7',
      icon: 'Shield',
      labels: [],
      players: [{ id: 'p1', name: 'Ana Different' }],
    }
    const result = await importTeamQr(payload)
    expect(result.pendingConflicts).toHaveLength(1)
    expect(result.createdPlayerIds).toHaveLength(0)
  })

  it('upserts an existing team on re-import', async () => {
    await db.managedTeams.add({
      id: 't1',
      name: 'Old Name',
      color: '#000',
      icon: 'Flag',
      labelIds: [],
      playerIds: [],
      archivedAt: null,
      totalScore: 0,
      gameLog: [],
    })
    const payload: TeamQrPayload = {
      type: 'viktorani/team/v1',
      id: 't1',
      name: 'New Name',
      color: '#3a57b7',
      icon: 'Shield',
      labels: [],
      players: [],
    }
    await importTeamQr(payload)
    const team = await db.managedTeams.get('t1')
    expect(team?.name).toBe('New Name')
    expect(team?.color).toBe('#3a57b7')
  })
})

// ── PlayerMergeModal ──────────────────────────────────────────────────────────

describe('PlayerMergeModal', () => {
  it('shows diff fields with radio buttons', async () => {
    const conflict = {
      existing: {
        id: 'p1',
        name: 'Ana',
        teamIds: [],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      incoming: { type: 'viktorani/player/v1' as const, id: 'p1', name: 'Ana K.', labels: [] },
      diffs: [{ field: 'name' as const, current: 'Ana', incoming: 'Ana K.' }],
    }
    const onApply = vi.fn()
    renderInRouter(
      <PlayerMergeModal open conflict={conflict} onApply={onApply} onCancel={() => {}} />
    )
    expect(screen.getByLabelText(/keep current name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/use incoming name/i)).toBeInTheDocument()
  })

  it('calls onApply with correct choices when Apply merge is clicked', async () => {
    const conflict = {
      existing: {
        id: 'p1',
        name: 'Ana',
        teamIds: [],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      incoming: { type: 'viktorani/player/v1' as const, id: 'p1', name: 'Ana K.', labels: [] },
      diffs: [{ field: 'name' as const, current: 'Ana', incoming: 'Ana K.' }],
    }
    const onApply = vi.fn()
    renderInRouter(
      <PlayerMergeModal open conflict={conflict} onApply={onApply} onCancel={() => {}} />
    )
    fireEvent.click(screen.getByLabelText(/use incoming name/i))
    fireEvent.click(screen.getByRole('button', { name: /apply merge/i }))
    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith({ name: 'incoming', labels: 'current' })
    })
  })

  it('calls onCancel when Cancel is clicked', () => {
    const conflict = {
      existing: {
        id: 'p1',
        name: 'Ana',
        teamIds: [],
        labelIds: [],
        archivedAt: null,
        totalScore: 0,
        gameLog: [],
      },
      incoming: { type: 'viktorani/player/v1' as const, id: 'p1', name: 'Ana K.', labels: [] },
      diffs: [{ field: 'name' as const, current: 'Ana', incoming: 'Ana K.' }],
    }
    const onCancel = vi.fn()
    renderInRouter(
      <PlayerMergeModal open conflict={conflict} onApply={() => {}} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
