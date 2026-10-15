import { describe, it, expect, vi } from 'vitest'
import type { Layout } from '@/db'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import { GameEventSchemas, MAX_LAYOUT_EVENT_LENGTH, MAX_LAYOUT_WIDGETS } from '@/transport/messages'
import { buildLayoutEvent } from '@/pages/admin/remote-layouts'
import type { LayoutBundle } from '@/widgets/layouts'

function bundle(id: string, layout: Partial<Layout> = {}, widgetCount = 1): LayoutBundle {
  return {
    layout: {
      id,
      gameId: 'g1',
      name: id,
      target: 'player',
      phase: null,
      theme: { ...DEFAULT_LAYOUT_THEME },
      isActive: true,
      order: 0,
      ...layout,
    },
    widgets: Array.from({ length: widgetCount }, (_, i) => ({
      id: `${id}-w${i}`,
      layoutId: id,
      type: 'question' as const,
      config: {},
      grid: { x: 0, y: i % 100, w: 12, h: 1 },
      breakpoints: {},
      order: i,
    })),
  }
}

const logo = (n: number) => `data:image/png;base64,${'A'.repeat(n)}`

describe('buildLayoutEvent', () => {
  it("sends each phase's pick for the target, passing the LAYOUT schema", () => {
    const stored = [
      bundle('all'),
      bundle('ended', { phase: 'ended' }),
      bundle('screen', { target: 'screen' }),
    ]
    const event = buildLayoutEvent(stored, 'player', 'g1')
    expect(event).toMatchObject({ type: 'LAYOUT', target: 'player', gameId: 'g1' })
    expect(event.layouts.map(b => b.layout.id).sort()).toEqual(['all', 'ended'])
    expect(GameEventSchemas.LAYOUT.safeParse(event).success).toBe(true)
  })

  it('leaves out logos that make it too large, and keeps the layouts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const big = { ...DEFAULT_LAYOUT_THEME, logo: logo(MAX_LAYOUT_EVENT_LENGTH / 2) }
    const stored = [bundle('all', { theme: big }), bundle('ended', { phase: 'ended', theme: big })]
    const event = buildLayoutEvent(stored, 'player', 'g1')
    expect(event.layouts).toHaveLength(2)
    expect(event.layouts.every(b => b.layout.theme.logo === null)).toBe(true)
    expect(GameEventSchemas.LAYOUT.safeParse(event).success).toBe(true)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('sends no layouts when they still do not pass, so the surface keeps its default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const event = buildLayoutEvent([bundle('huge', {}, MAX_LAYOUT_WIDGETS + 1)], 'player', 'g1')
    expect(event.layouts).toEqual([])
    expect(GameEventSchemas.LAYOUT.safeParse(event).success).toBe(true)
    warn.mockRestore()
  })
})
