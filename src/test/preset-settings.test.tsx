import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PresetSettings from '@/components/settings/PresetSettings'
import { BUILT_IN_PRESETS } from '@/components/game-settings/game-settings'
import { getSettings, setSettings } from '@/lib/app-settings'

const labels = () => getSettings().gamePresets.map(p => p.label)

beforeEach(() => {
  localStorage.clear()
  setSettings({ confirmDestructive: false })
})

describe('PresetSettings', () => {
  it('lists the built-in presets', () => {
    render(<PresetSettings />)
    const list = screen.getByRole('list', { name: 'Presets' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(BUILT_IN_PRESETS.length)
  })

  it('adds a preset from the game defaults', async () => {
    setSettings({ gameDefaults: { ...getSettings().gameDefaults, maxTeams: 4 } })
    render(<PresetSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Add preset' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Four teams')
    await userEvent.click(screen.getByRole('button', { name: 'Save preset' }))
    expect(getSettings().gamePresets.at(-1)).toMatchObject({
      label: 'Four teams',
      settings: { maxTeams: 4 },
    })
  })

  it('renames, moves and deletes presets, and resets the built-ins', async () => {
    render(<PresetSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Pub quiz' }))
    await userEvent.clear(screen.getByLabelText('Name'))
    await userEvent.type(screen.getByLabelText('Name'), 'Pub')
    await userEvent.click(screen.getByRole('button', { name: 'Save preset' }))
    expect(labels()).toEqual(['Open lobby', 'Pub', 'Classroom'])

    await userEvent.click(screen.getByRole('button', { name: 'Move Pub up' }))
    expect(labels()).toEqual(['Pub', 'Open lobby', 'Classroom'])

    await userEvent.click(screen.getByRole('button', { name: 'Delete Classroom' }))
    expect(labels()).toEqual(['Pub', 'Open lobby'])

    await userEvent.click(screen.getByRole('button', { name: 'Reset built-ins' }))
    expect(getSettings().gamePresets).toEqual(BUILT_IN_PRESETS)
  })
})
