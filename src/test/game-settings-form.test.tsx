import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameSettingsForm } from '@/components/game-settings/GameSettingsForm'
import {
  BUILT_IN_PRESETS,
  LIVE_PRESET_KEYS,
  defaultSettings,
  matchPreset,
  type GameSettings,
} from '@/components/game-settings/game-settings'
import { getSettings } from '@/lib/app-settings'

beforeEach(() => {
  localStorage.clear()
})

const classroom = BUILT_IN_PRESETS.find(p => p.id === 'classroom')!

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
  it('recognises every built-in preset', () => {
    for (const p of BUILT_IN_PRESETS) {
      expect(matchPreset(p.settings, BUILT_IN_PRESETS)?.id).toBe(p.id)
    }
  })

  it('compares every setting, or only joining and the buzzer during a game', () => {
    const s = defaultSettings()
    s.scoringEnabled = false
    s.visibility = { ...s.visibility, players: { ...s.visibility.players, showAnswers: true } }
    expect(matchPreset(s, BUILT_IN_PRESETS)).toBeNull()
    expect(matchPreset(s, BUILT_IN_PRESETS, LIVE_PRESET_KEYS)?.id).toBe('open')
  })

  it('returns null for customised settings', () => {
    expect(matchPreset({ ...defaultSettings(), maxTeams: 3 }, BUILT_IN_PRESETS)).toBeNull()
  })
})

describe('GameSettingsForm', () => {
  it('starts on the open lobby preset with the advanced settings collapsed', () => {
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'Preset' })).toHaveValue('open')
    expect(screen.getByRole('switch', { name: 'Scoring' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Allow late join' })).not.toBeInTheDocument()
  })

  it('applies a preset as one patch', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Preset' }), 'Classroom')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(classroom.settings)
    expect(screen.getByRole('combobox', { name: 'Preset' })).toHaveValue('classroom')
  })

  it('during a game applies only the joining and buzzer settings of a preset', async () => {
    const onChange = vi.fn()
    render(<Harness mode="live" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Preset' }), 'Classroom')
    const patch = onChange.mock.calls[0][0]
    expect(Object.keys(patch).sort()).toEqual([...LIVE_PRESET_KEYS].sort())
    expect(patch.requireApproval).toBe(true)
  })

  it('saves the current settings as a new preset', async () => {
    render(<Harness initial={{ ...defaultSettings(), maxPerTeam: 3 }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save as preset' }))
    await userEvent.type(screen.getByLabelText('Preset name'), 'Trios{Enter}')
    const saved = getSettings().gamePresets.at(-1)
    expect(saved).toMatchObject({ label: 'Trios', settings: { maxPerTeam: 3 } })
    expect(screen.getByRole('combobox', { name: 'Preset' })).toHaveValue(saved?.id)
  })

  it('shows Custom once a setting no longer matches a preset', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /Advanced/ }))
    await userEvent.click(screen.getByRole('switch', { name: 'Require approval' }))
    expect(screen.getByText(/^Custom:/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Preset' })).toHaveValue('')
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
    expect(screen.getAllByText('No limit')).toHaveLength(3)
  })

  it('changes the buzz display with the segmented control', async () => {
    const onChange = vi.fn()
    render(<Harness mode="live" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'All attempts' }))
    expect(onChange).toHaveBeenCalledWith({ buzzDeduplication: 'all' })
  })

  it('hides the rest of the buzzer section when the buzzer is turned off', async () => {
    render(<Harness mode="live" />)
    expect(screen.getByRole('switch', { name: 'Record false starts' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'Buzzer' }))
    expect(screen.queryByRole('switch', { name: 'Auto-lock after a correct answer' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Record false starts' })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Buzz display' })).toBeNull()
  })

  it('in live mode shows joining and buzzer, locks scoring and hides visibility', () => {
    render(<Harness mode="live" />)
    expect(screen.getByRole('switch', { name: 'Allow late join' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Record false starts' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Scoring' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
