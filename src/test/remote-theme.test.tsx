// @vitest-pool vmForks
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppTheme } from '@/components/AppTheme'
import { ModeSwitch } from '@/components/ModeSwitch'
import { useRemoteTheme } from '@/hooks/useAppTheme'
import { getSettings } from '@/lib/app-settings'
import { BUILT_IN_THEMES, resolveTheme } from '@/lib/theme'
import type { ResolvedTheme } from '@/lib/theme'
import { buildThemeEvent } from '@/pages/admin/remote-theme'
import { GameEventSchemas, MAX_THEME_EVENT_LENGTH } from '@/transport/messages'

const [classic, , modern] = BUILT_IN_THEMES
const accent = () => document.documentElement.style.getPropertyValue('--color-accent')

beforeEach(() => localStorage.clear())

describe('buildThemeEvent', () => {
  const theme = resolveTheme({ app: modern, surface: 'player' })
  const big = `data:image/png;base64,${'A'.repeat(MAX_THEME_EVENT_LENGTH / 2)}`

  it('sends the theme as is when it fits', () => {
    expect(buildThemeEvent(theme)).toEqual({ type: 'THEME', theme })
  })

  it('leaves out the square logo, then both, until it fits', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const one = buildThemeEvent({ ...theme, logo: { wordmark: big, mark: big } })
    expect(one.theme.logo).toEqual({ wordmark: big, mark: null })
    const huge = `data:image/png;base64,${'A'.repeat(MAX_THEME_EVENT_LENGTH)}`
    const none = buildThemeEvent({ ...theme, logo: { wordmark: huge, mark: null } })
    expect(none.theme.logo).toEqual({ wordmark: null, mark: null })
    expect(GameEventSchemas.THEME.safeParse(none).success).toBe(true)
  })
})

function Remote({ theme }: { theme: ResolvedTheme | null }) {
  useRemoteTheme(theme)
  return null
}

describe('useRemoteTheme', () => {
  it("shows the host's theme in this device's mode, and its own theme without one", () => {
    const theme = resolveTheme({ app: modern, surface: 'player' })
    const { rerender } = render(
      <>
        <AppTheme />
        <Remote theme={theme} />
      </>
    )
    expect(accent()).toBe(theme.light.accent)
    rerender(
      <>
        <AppTheme />
        <Remote theme={null} />
      </>
    )
    expect(accent()).toBe(classic.light.accent)
  })
})

describe('ModeSwitch', () => {
  it("switches this device's mode, and the host's dark palette with it", async () => {
    const theme = resolveTheme({ app: modern, surface: 'player' })
    render(
      <>
        <AppTheme />
        <Remote theme={theme} />
        <ModeSwitch />
      </>
    )
    const group = screen.getByRole('radiogroup', { name: 'Light or dark' })
    expect(group).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(getSettings().theme).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    expect(accent()).toBe(theme.dark.accent)
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(accent()).toBe(theme.light.accent)
  })
})
