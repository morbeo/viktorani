// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, ControlSizeContext, ControlSizePicker, pickBySize } from '@/components/ui'
import type { ControlSize } from '@/components/ui'

function Harness({ initial = 'sm' as ControlSize }) {
  const [size, setSize] = useState<ControlSize>(initial)
  return (
    <ControlSizeContext.Provider value={{ size, setSize }}>
      <ControlSizePicker />
      <Button size="sm">Go</Button>
    </ControlSizeContext.Provider>
  )
}

describe('control size', () => {
  it('leaves buttons unchanged outside a provider', () => {
    render(<Button size="sm">Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('px-3 py-1.5')
  })

  it('shifts buttons down a step for small and up a step for large', async () => {
    render(<Harness />)
    const btn = screen.getByRole('button', { name: 'Go' })
    expect(btn.className).toContain('px-2 py-1')
    await userEvent.click(screen.getByRole('radio', { name: 'Large controls' }))
    expect(btn.className).toContain('px-4 py-2')
    expect(screen.getByRole('radio', { name: 'Large controls' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('renders no picker outside a provider', () => {
    render(<ControlSizePicker />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('clamps pickBySize to the three values', () => {
    expect(pickBySize(-1, ['a', 'b', 'c'] as const)).toBe('a')
    expect(pickBySize(1, ['a', 'b', 'c'] as const)).toBe('c')
    expect(pickBySize(5, ['a', 'b', 'c'] as const)).toBe('c')
  })
})
