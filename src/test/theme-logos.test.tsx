// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppTheme } from '@/components/AppTheme'
import { ModeSwitch } from '@/components/ModeSwitch'
import { ThemeLogo } from '@/components/ThemeLogo'
import { ScreenView } from '@/components/screen/ScreenView'
import { useRemoteTheme } from '@/hooks/useAppTheme'
import { BUILT_IN_THEMES, resolveTheme } from '@/lib/theme'
import type { ResolvedTheme } from '@/lib/theme'
import type { ScreenData } from '@/widgets/types'

const [classic, pub] = BUILT_IN_THEMES
const WORDMARK = 'data:image/png;base64,d29yZA=='
const MARK = 'data:image/png;base64,bWFyaw=='
const branded: ResolvedTheme = {
  ...resolveTheme({ app: pub, surface: 'player' }),
  logo: { wordmark: WORDMARK, mark: MARK },
}

function Remote({ theme }: { theme: ResolvedTheme | null }) {
  useRemoteTheme(theme)
  return null
}

beforeEach(() => localStorage.clear())

describe('ThemeLogo', () => {
  it("shows the page theme's wordmark or mark", () => {
    render(
      <>
        <Remote theme={branded} />
        <ThemeLogo kind="wordmark" />
        <ThemeLogo kind="mark" />
      </>
    )
    const logos = screen.getAllByRole('img', { name: 'Pub logo' })
    expect(logos.map(l => l.getAttribute('src'))).toEqual([WORDMARK, MARK])
  })

  it('shows the fallback when the theme has no logo', () => {
    render(<ThemeLogo kind="wordmark" fallback={<h1>Viktorani</h1>} />)
    expect(screen.getByRole('heading', { name: 'Viktorani' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('screen logo', () => {
  const DATA: ScreenData = {
    heading: 'Round 1',
    content: null,
    message: null,
    rows: [],
    logEntries: [],
    timers: null,
  }

  it("shows the theme's wordmark when the layout has no logo", () => {
    const { container } = render(
      <>
        <Remote theme={branded} />
        <ScreenView data={DATA} />
      </>
    )
    expect(container.querySelector('main > img')).toHaveAttribute('src', WORDMARK)
  })
})

describe('browser bar colour', () => {
  const meta = () => document.querySelector('meta[name="theme-color"]')

  it("follows the theme's background in this device's mode", async () => {
    render(
      <>
        <AppTheme />
        <Remote theme={branded} />
        <ModeSwitch />
      </>
    )
    expect(meta()).toHaveAttribute('content', branded.light.bg)
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(meta()).toHaveAttribute('content', branded.dark.bg)
  })

  it('uses Classic without a game theme', () => {
    render(<AppTheme />)
    expect(meta()).toHaveAttribute('content', classic.light.bg)
  })
})
