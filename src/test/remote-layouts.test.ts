import { describe, it, expect, vi } from 'vitest'
import { GAME_PHASES, type Layout } from '@/db'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import { GameEventSchemas, MAX_LAYOUT_EVENT_LENGTH, MAX_LAYOUT_WIDGETS } from '@/transport/messages'
import { buildLayoutEvent } from '@/pages/admin/remote-layouts'
import type { LayoutBundle } from '@/widgets/layouts'
import { MAX_IMAGE_SRC_LENGTH } from '@/widgets/content-config'

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

  it('then leaves out inlined images, keeping linked ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const theme = { ...DEFAULT_LAYOUT_THEME, logo: logo(MAX_LAYOUT_EVENT_LENGTH / 2) }
    // Two images per layout, so the images alone are too large too
    const withImage = (id: string, src: string, phase: Layout['phase']) => {
      const b = bundle(id, { phase, theme })
      for (const n of [1, 2]) {
        b.widgets.push({ ...b.widgets[0], id: `${id}-img${n}`, type: 'image', config: { src } })
      }
      return b
    }
    // Every phase inlines its images, except the ended one, which links to them
    const stored = GAME_PHASES.map(phase =>
      phase === 'ended'
        ? withImage(phase, 'https://example.com/a.png', phase)
        : withImage(phase, logo(MAX_IMAGE_SRC_LENGTH - 100), phase)
    )
    stored.push(withImage('all', logo(MAX_IMAGE_SRC_LENGTH - 100), null))
    const event = buildLayoutEvent(stored, 'player', 'g1')
    const srcs = event.layouts.flatMap(b =>
      b.widgets.filter(w => w.type === 'image').map(w => w.config.src)
    )
    const linked = 'https://example.com/a.png'
    expect(srcs.sort()).toEqual([...Array(GAME_PHASES.length * 2).fill(''), linked, linked])
    expect(event.layouts.every(b => b.layout.theme.logo === null)).toBe(true)
    expect(GameEventSchemas.LAYOUT.safeParse(event).success).toBe(true)
    warn.mockRestore()
  })

  it('sends no layouts when they still do not pass, so the surface keeps its default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const event = buildLayoutEvent([bundle('huge', {}, MAX_LAYOUT_WIDGETS + 1)], 'player', 'g1')
    expect(event.layouts).toEqual([])
    expect(GameEventSchemas.LAYOUT.safeParse(event).success).toBe(true)
    warn.mockRestore()
  })

  it("carries the host's choices, and sends the chosen layout", () => {
    const stored = [bundle('all'), bundle('tpl', { gameId: null })]
    const event = buildLayoutEvent(stored, 'player', 'g1', { reveal: 'tpl' })
    expect(event.assignments).toEqual({ reveal: 'tpl' })
    expect(event.layouts.map(b => b.layout.id).sort()).toEqual(['all', 'tpl'])
    expect(GameEventSchemas.LAYOUT.safeParse(event).success).toBe(true)
  })

  it('drops the choices along with the layouts when they still do not pass', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stored = [bundle('huge', {}, MAX_LAYOUT_WIDGETS + 1)]
    const event = buildLayoutEvent(stored, 'player', 'g1', { all: 'huge' })
    expect(event).toMatchObject({ layouts: [], assignments: {} })
    warn.mockRestore()
  })
})
