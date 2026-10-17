import { describe, it, expect } from 'vitest'
import type { LayoutTheme, Theme } from '@/db'
import { contrastRatio } from '@/lib/contrast'
import {
  BUILT_IN_THEMES,
  DEFAULT_THEME_ID,
  FONT_STACKS,
  TOKEN_VARS,
  findTheme,
  paletteVars,
  readableOn,
  resolveTheme,
} from '@/lib/theme'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'

const classic = BUILT_IN_THEMES[0]
const paper = BUILT_IN_THEMES.find(t => t.id === 'paper')!
const pub = BUILT_IN_THEMES.find(t => t.id === 'pub')!

const user: Theme = { ...pub, id: 'u1', name: 'Mine' }
const layout = (patch: Partial<LayoutTheme>): LayoutTheme => ({ ...DEFAULT_LAYOUT_THEME, ...patch })

describe('built-in themes', () => {
  it('start with Classic, the default', () => {
    expect(classic.id).toBe(DEFAULT_THEME_ID)
    expect(new Set(BUILT_IN_THEMES.map(t => t.id)).size).toBe(BUILT_IN_THEMES.length)
  })

  it.each(BUILT_IN_THEMES.map(t => [t.id, t] as const))(
    '%s is readable in both modes',
    (_id, theme) => {
      const resolved = resolveTheme({ app: theme, surface: 'admin' })
      for (const p of [resolved.light, resolved.dark]) {
        expect(contrastRatio(p.text, p.bg)).toBeGreaterThanOrEqual(7)
        expect(contrastRatio(p.text, p.surface)).toBeGreaterThanOrEqual(7)
        expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5)
        // Classic's muted text predates the themes and sits just under AA.
        expect(contrastRatio(p.muted, p.bg)).toBeGreaterThanOrEqual(theme === classic ? 4.3 : 4.5)
      }
    }
  )

  it('have a stack for every font they use', () => {
    for (const t of BUILT_IN_THEMES) {
      for (const key of Object.values(t.fonts)) expect(FONT_STACKS[key]).toBeTruthy()
    }
  })
})

describe('findTheme', () => {
  it('finds built-in and user themes, and falls back to Classic', () => {
    expect(findTheme('pub', [user])).toBe(pub)
    expect(findTheme('u1', [user])).toBe(user)
    expect(findTheme('deleted', [user])).toBe(classic)
    expect(findTheme(null, [])).toBe(classic)
  })
})

describe('readableOn', () => {
  it('picks black or white for contrast', () => {
    expect(readableOn('#ffffff')).toBe('#000000')
    expect(readableOn('#111111')).toBe('#ffffff')
    expect(readableOn('#c9a84c')).toBe('#000000')
  })
})

describe('resolveTheme', () => {
  it('uses the game theme over the app theme', () => {
    expect(resolveTheme({ app: classic, game: user, surface: 'screen' }).name).toBe('Mine')
    expect(resolveTheme({ app: classic, game: null, surface: 'screen' }).name).toBe('Classic')
  })

  it('fills a missing onAccent from the accent', () => {
    const r = resolveTheme({ app: pub, surface: 'admin' })
    expect(r.light.onAccent).toBe('#ffffff')
    expect(r.dark.onAccent).toBe('#000000')
  })

  it("gives a light-only theme Classic's dark palette with its own accent", () => {
    const r = resolveTheme({ app: paper, surface: 'admin' })
    expect(r.dark).toEqual({
      ...resolveTheme({ app: classic, surface: 'admin' }).dark,
      accent: paper.light.accent,
      onAccent: readableOn(paper.light.accent),
    })
  })

  it('applies layout colours to both palettes on shared surfaces', () => {
    const r = resolveTheme({
      app: classic,
      layout: layout({ background: '#102030', accent: '#ffcc00' }),
      surface: 'screen',
    })
    for (const p of [r.light, r.dark]) {
      expect(p.bg).toBe('#102030')
      expect(p.accent).toBe('#ffcc00')
      expect(p.onAccent).toBe('#000000')
    }
  })

  it('applies layout colours only to the light palette on the player surface', () => {
    const r = resolveTheme({
      app: classic,
      layout: layout({ background: '#fafafa', accent: '#123456' }),
      surface: 'player',
    })
    expect(r.light).toMatchObject({ bg: '#fafafa', accent: '#123456', onAccent: '#ffffff' })
    expect(r.dark).toEqual(resolveTheme({ app: classic, surface: 'player' }).dark)
  })

  it("lets a layout logo replace the theme's wordmark only", () => {
    const withLogo = { ...user, logo: { wordmark: 'https://a/w.png', mark: 'https://a/m.png' } }
    const r = resolveTheme({
      app: withLogo,
      layout: layout({ logo: 'https://b/l.png' }),
      surface: 'screen',
    })
    expect(r.logo).toEqual({ wordmark: 'https://b/l.png', mark: 'https://a/m.png' })
    expect(resolveTheme({ app: withLogo, layout: layout({}), surface: 'screen' }).logo).toEqual(
      withLogo.logo
    )
  })
})

describe('paletteVars', () => {
  it('maps every token to its CSS variable', () => {
    const vars = paletteVars(resolveTheme({ app: classic, surface: 'admin' }).light)
    expect(Object.keys(vars).sort()).toEqual(Object.values(TOKEN_VARS).sort())
    expect(vars['--color-accent-subtle']).toBe(classic.light.accentSubtle)
  })
})
