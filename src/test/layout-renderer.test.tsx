import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Layout, Widget } from '@/db'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import { LayoutRenderer } from '@/widgets/LayoutRenderer'
import type { LayoutBundle } from '@/widgets/layouts'
import type { ScreenData } from '@/widgets/types'

const DATA: ScreenData = {
  heading: 'Round 1',
  content: null,
  message: 'Hello room',
  rows: [{ id: 'a', name: 'Alpha', score: 3 }],
  logEntries: [],
  timers: <p>01:00</p>,
}

function bundle(widgets: Partial<Widget>[], layout: Partial<Layout> = {}): LayoutBundle {
  return {
    layout: {
      id: 'l1',
      gameId: null,
      name: 'L',
      target: 'screen',
      phase: null,
      theme: { ...DEFAULT_LAYOUT_THEME },
      isActive: true,
      order: 0,
      ...layout,
    },
    widgets: widgets.map((w, i) => ({
      id: `w${i}`,
      layoutId: 'l1',
      type: 'round_info',
      config: {},
      grid: { x: 0, y: i, w: 12, h: 1 },
      breakpoints: {},
      order: i,
      ...w,
    })),
  }
}

function renderLayout(b: LayoutBundle, data: ScreenData = DATA, breakpoint: 'tv' | null = null) {
  return render(<LayoutRenderer bundle={b} target="screen" data={data} breakpoint={breakpoint} />)
}

const cells = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>('[data-widget]'),
]

describe('LayoutRenderer', () => {
  it('renders each widget with the surface data', () => {
    renderLayout(bundle([{ type: 'announcement' }, { type: 'round_info' }, { type: 'scoreboard' }]))
    expect(screen.getByRole('status')).toHaveTextContent('Hello room')
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('renders the surface-supplied timers slot', () => {
    renderLayout(bundle([{ type: 'timer' }]))
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })

  it('places widgets in reading order, whatever order they are stored in', () => {
    const { container } = renderLayout(
      bundle([
        { id: 'b', type: 'scoreboard', order: 2 },
        { id: 'a', type: 'announcement', order: 1 },
      ])
    )
    expect(cells(container).map(c => c.dataset.widget)).toEqual(['announcement', 'scoreboard'])
  })

  it('positions each cell on the 12-column grid', () => {
    const { container } = renderLayout(bundle([{ grid: { x: 6, y: 2, w: 6, h: 3 } }]))
    const [cell] = cells(container)
    expect(cell.style.gridColumn).toBe('7 / span 6')
    expect(cell.style.gridRow).toBe('3 / span 3')
  })

  it('uses the breakpoint override when it has one', () => {
    const b = bundle([
      { grid: { x: 6, y: 0, w: 6, h: 1 }, breakpoints: { tv: { x: 0, y: 4, w: 12, h: 1 } } },
    ])
    const [cell] = cells(renderLayout(b, DATA, 'tv').container)
    expect(cell.style.gridColumn).toBe('1 / span 12')
    expect(cell.style.gridRow).toBe('5 / span 1')
  })

  it('hides cells whose widget renders nothing', () => {
    const { container } = renderLayout(bundle([{ type: 'announcement' }]), {
      ...DATA,
      message: null,
    })
    const [cell] = cells(container)
    expect(cell).toBeEmptyDOMElement()
    expect(cell).toHaveClass('empty:hidden')
  })

  it('leaves out widgets with no component on the target or an invalid config', () => {
    const { container } = renderLayout(
      bundle([
        { type: 'buzzer' },
        { type: 'round_info', config: { unexpected: true } },
        { type: 'scoreboard' },
      ])
    )
    expect(cells(container).map(c => c.dataset.widget)).toEqual(['scoreboard'])
  })

  it('applies the layout theme over the base style', () => {
    const { container } = render(
      <LayoutRenderer
        bundle={bundle([], {
          theme: { background: '#102030', accent: '#c8933a', fontScale: 1.5, logo: null },
        })}
        target="screen"
        data={DATA}
        style={{ background: 'white', color: 'black' }}
      />
    )
    const root = container.firstElementChild as HTMLElement
    const style = root.getAttribute('style')
    expect(style).toContain('--color-bg: #102030')
    expect(style).toContain('background: var(--color-bg)')
    expect(root.style.color).toBe('black')
    expect(root.style.getPropertyValue('--color-accent')).toBe('#c8933a')
    expect(root.style.getPropertyValue('--color-on-accent')).toBe('#000000')
    expect(root.style.zoom).toBe('1.5')
  })

  it('keeps the dark palette on a dark player phone, but not on the screen', () => {
    const theme = { background: '#ffffff', accent: '#c8933a', fontScale: 1, logo: null }
    const player = render(
      <LayoutRenderer bundle={bundle([], { theme })} target="player" data={DATA as never} dark />
    )
    expect((player.container.firstElementChild as HTMLElement).getAttribute('style')).toBeNull()
    const screen = render(
      <LayoutRenderer bundle={bundle([], { theme })} target="screen" data={DATA} dark />
    )
    const root = screen.container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--color-bg')).toBe('#ffffff')
  })

  it('leaves the base style alone with the default theme', () => {
    const { container } = render(
      <LayoutRenderer bundle={bundle([])} target="screen" data={DATA} style={{ color: 'black' }} />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('style')).toBe('color: black;')
  })

  it("shows the theme's logo", () => {
    const logo = 'data:image/png;base64,AAAA'
    const { container } = renderLayout(bundle([], { theme: { ...DEFAULT_LAYOUT_THEME, logo } }))
    expect(container.querySelector('img')).toHaveAttribute('src', logo)
  })

  it('renders as the requested root element', () => {
    render(<LayoutRenderer as="main" bundle={bundle([])} target="screen" data={DATA} />)
    expect(screen.getByRole('main')).toHaveAttribute('data-layout-id', 'l1')
  })
})
