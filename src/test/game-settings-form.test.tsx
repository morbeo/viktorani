import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameSettingsForm } from '@/components/game-settings/GameSettingsForm'
import {
  PRESETS,
  defaultSettings,
  matchPreset,
  type GameSettings,
} from '@/components/game-settings/game-settings'

/** Renders the form with its own state, as the wizard does, and records every patch. */
function Harness({
  initial = defaultSettings(),
  mode = 'create',
  onChange = () => {},
}: {
  initial?: GameSettings
  mode?: 'create' | 'live'
  onChange?: (patch: Partial<GameSettings>) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <GameSettingsForm
      value={value}
      mode={mode}
      onChange={patch => {
        onChange(patch)
        setValue(v => ({ ...v, ...patch }))
      }}
    />
  )
}

describe('matchPreset', () => {
  it('recognises every preset', () => {
    for (const p of PRESETS) {
      expect(matchPreset({ ...defaultSettings(), ...p.settings })).toBe(p.id)
    }
  })

  it('ignores scoring and visibility', () => {
    const s = defaultSettings()
    s.scoringEnabled = false
    s.visibility = { ...s.visibility, players: { ...s.visibility.players, showAnswers: true } }
    expect(matchPreset(s)).toBe('open')
  })

  it('returns null for customised settings', () => {
    expect(matchPreset({ ...defaultSettings(), maxTeams: 3 })).toBeNull()
  })
})

describe('GameSettingsForm', () => {
  it('starts on the open lobby preset with the advanced settings collapsed', () => {
    render(<Harness />)
    expect(screen.getByRole('radio', { name: 'Open lobby' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('switch', { name: 'Scoring' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Allow late join' })).not.toBeInTheDocument()
  })

  it('applies a preset as one patch', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Classroom' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(PRESETS.find(p => p.id === 'classroom')?.settings)
    expect(screen.getByRole('radio', { name: 'Classroom' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('shows Custom once a setting no longer matches a preset', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /Advanced/ }))
    await userEvent.click(screen.getByRole('switch', { name: 'Require approval' }))
    expect(screen.getByText(/Custom/)).toBeInTheDocument()
    const presets = screen.getByRole('radiogroup', { name: 'Preset' })
    expect(within(presets).queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('edits visibility through the matrix', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Screen: Answers' }))
    expect(onChange).toHaveBeenCalledWith({
      visibility: expect.objectContaining({
        screen: { showQuestion: true, showAnswers: true, showMedia: true },
      }),
    })
    expect(screen.getByRole('checkbox', { name: 'Players: Answers' })).not.toBeChecked()
  })

  it('steps a team limit up from No limit and back', async () => {
    const onChange = vi.fn()
    render(<Harness mode="live" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Decrease Max teams' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Increase Max teams' }))
    await userEvent.click(screen.getByRole('button', { name: 'Increase Max teams' }))
    expect(onChange).toHaveBeenLastCalledWith({ maxTeams: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'No limit for Max teams' }))
    expect(onChange).toHaveBeenLastCalledWith({ maxTeams: 0 })
    expect(screen.getAllByText('No limit')).toHaveLength(2)
  })

  it('changes the buzz display with the segmented control', async () => {
    const onChange = vi.fn()
    render(<Harness mode="live" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'All attempts' }))
    expect(onChange).toHaveBeenCalledWith({ buzzDeduplication: 'all' })
  })

  it('in live mode shows joining and buzzer, locks scoring and hides visibility', () => {
    render(<Harness mode="live" />)
    expect(screen.getByRole('switch', { name: 'Allow late join' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Record false starts' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Scoring' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
