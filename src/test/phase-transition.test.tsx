import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PhaseTransition } from '@/components/screen/PhaseTransition'
import { STUDIO_MOVES } from '@/lib/studio'

const wrapper = (container: HTMLElement) => container.firstElementChild as HTMLElement

describe('PhaseTransition', () => {
  it('cuts without an animation, and keeps the layout mounted across phases', () => {
    const { container, rerender, getByText } = render(
      <PhaseTransition phase="question">
        <p>layout</p>
      </PhaseTransition>
    )
    const layout = getByText('layout')
    expect(wrapper(container)).toHaveAttribute('data-transition', 'cut')
    expect(wrapper(container).className).toBe('')
    rerender(
      <PhaseTransition phase="buzzed">
        <p>layout</p>
      </PhaseTransition>
    )
    expect(getByText('layout')).toBe(layout)
  })

  it.each(STUDIO_MOVES)('plays %s only for viewers who allow motion', transition => {
    const { container } = render(
      <PhaseTransition phase="reveal" transition={transition}>
        <p>layout</p>
      </PhaseTransition>
    )
    expect(wrapper(container)).toHaveAttribute('data-transition', transition)
    expect(container.innerHTML).toMatch(/motion-safe:animate-/)
  })

  it('dips under a black cover that clears, hidden from assistive tech', () => {
    const { container } = render(
      <PhaseTransition phase="reveal" transition="dip">
        <p>layout</p>
      </PhaseTransition>
    )
    const cover = container.querySelector('[aria-hidden="true"]')
    expect(cover?.className).toContain('motion-safe:animate-dip-clear')
    expect(cover?.className).toContain('opacity-0')
  })

  it('sets the duration for a short or slow take', () => {
    const view = (speed: 'short' | 'normal' | 'slow') =>
      wrapper(
        render(
          <PhaseTransition phase="reveal" transition="slide" speed={speed}>
            <p>layout</p>
          </PhaseTransition>
        ).container
      )
    expect(view('short').className).toContain('[--studio-duration:0.3s]')
    expect(view('slow').className).toContain('[--studio-duration:1.2s]')
    expect(view('normal').className).not.toContain('--studio-duration')
  })

  it('replays the animation when another take moves to a new phase', () => {
    const { rerender, getByText } = render(
      <PhaseTransition phase="question" transition="zoom">
        <p>layout</p>
      </PhaseTransition>
    )
    const first = getByText('layout')
    rerender(
      <PhaseTransition phase="buzzed" transition="zoom">
        <p>layout</p>
      </PhaseTransition>
    )
    expect(getByText('layout')).not.toBe(first)
  })
})
