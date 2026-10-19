import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HostRulingPanel } from '@/components/host/HostRulingPanel'
import type { Player, Team } from '@/db'

const PLAYERS = [
  { id: 'p1', name: 'Alice', presence: 'connected' },
  { id: 'p2', name: 'Bob', presence: 'left' },
] as Player[]
const TEAMS = [{ id: 't1', name: 'Reds' }] as Team[]

function setup(props: Partial<Parameters<typeof HostRulingPanel>[0]> = {}) {
  const onRule = vi.fn()
  render(
    <HostRulingPanel
      status="pending"
      scoringEnabled
      players={PLAYERS}
      teams={TEAMS}
      onRule={onRule}
      {...props}
    />
  )
  return onRule
}

describe('HostRulingPanel', () => {
  it('rules correct with the chosen recipient', async () => {
    const onRule = setup()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Points to' }), 'Reds')
    await userEvent.click(screen.getByRole('button', { name: 'Correct' }))
    expect(onRule).toHaveBeenCalledWith('correct', { kind: 'team', id: 't1' })
  })

  it('rules correct with nobody by default, and wrong or skip never award', async () => {
    const onRule = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Correct' }))
    expect(onRule).toHaveBeenLastCalledWith('correct', null)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Points to' }), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: 'Wrong' }))
    expect(onRule).toHaveBeenLastCalledWith('incorrect', null)
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onRule).toHaveBeenLastCalledWith('skipped', null)
  })

  it("leaves out players who left, and marks the question's current ruling", () => {
    setup({ status: 'incorrect' })
    expect(screen.queryByRole('option', { name: 'Bob' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Wrong' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no recipient picker when scoring is off', () => {
    setup({ scoringEnabled: false })
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
