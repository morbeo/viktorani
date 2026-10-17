// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { db } from '@/db'
import type { Game } from '@/db'
import { AppTheme } from '@/components/AppTheme'
import { GameThemePicker } from '@/components/game-settings/GameThemePicker'
import { deleteTheme, duplicateTheme, saveTheme } from '@/db/themes'
import { useGameTheme } from '@/hooks/useAppTheme'
import { BUILT_IN_THEMES, findGameTheme, layoutVars } from '@/lib/theme'

const [classic, pub] = BUILT_IN_THEMES

beforeEach(async () => {
  localStorage.clear()
  await act(async () => {
    await db.themes.clear()
    await db.games.clear()
  })
})

describe('findGameTheme', () => {
  it('finds a built-in or own theme, and nothing for none or a deleted one', () => {
    const own = duplicateTheme(pub, 'Mine')
    expect(findGameTheme('pub', [])).toBe(pub)
    expect(findGameTheme(own.id, [own])).toBe(own)
    expect(findGameTheme('deleted', [own])).toBeNull()
    expect(findGameTheme(null, [own])).toBeNull()
    expect(findGameTheme(undefined, [own])).toBeNull()
  })
})

describe('layoutVars', () => {
  const layout = { background: '#ffffff', accent: '#1d4ed8', fontScale: 1, logo: null }

  it('overrides bg and accent with a readable on-accent', () => {
    expect(layoutVars(layout, 'screen', false)).toEqual({
      '--color-bg': '#ffffff',
      '--color-accent': '#1d4ed8',
      '--color-on-accent': '#ffffff',
    })
  })

  it('skips a dark player phone but not a dark screen', () => {
    expect(layoutVars(layout, 'player', true)).toEqual({})
    expect(layoutVars(layout, 'player', false)).not.toEqual({})
    expect(layoutVars(layout, 'screen', true)).not.toEqual({})
  })
})

function GamePage({ themeId }: { themeId: string | null }) {
  useGameTheme(themeId)
  return null
}

function Harness({ initial }: { initial: string | null }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <AppTheme />
      {open && <GamePage themeId={initial} />}
      <button onClick={() => setOpen(false)}>Leave</button>
    </>
  )
}

describe('useGameTheme', () => {
  const accent = () => document.documentElement.style.getPropertyValue('--color-accent')

  it("shows the game's theme while its page is open, then the app theme again", async () => {
    render(<Harness initial="pub" />)
    expect(accent()).toBe(pub.light.accent)
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(accent()).toBe(classic.light.accent)
  })

  it('keeps the app theme for a game without one', () => {
    render(<Harness initial={null} />)
    expect(accent()).toBe(classic.light.accent)
  })
})

describe('GameThemePicker', () => {
  function Picker({ initial }: { initial: string | null }) {
    const [value, setValue] = useState(initial)
    return (
      <>
        <GameThemePicker value={value} onChange={setValue} />
        <output>{String(value)}</output>
      </>
    )
  }

  it('offers the app theme, the built-ins and own themes', async () => {
    const own = duplicateTheme(pub, 'Mine')
    await act(() => saveTheme(own))
    render(<Picker initial={null} />)
    const select = screen.getByRole('combobox', { name: 'Theme' })
    await waitFor(() => expect(screen.getByRole('option', { name: 'Mine' })).toBeInTheDocument())
    expect(screen.getByRole('option', { name: 'App theme (Classic)' })).toBeInTheDocument()

    await userEvent.selectOptions(select, 'Pub')
    expect(screen.getByRole('status')).toHaveTextContent('pub')
    await userEvent.selectOptions(select, 'App theme (Classic)')
    expect(screen.getByRole('status')).toHaveTextContent('null')
  })

  it('shows a deleted theme as the app theme', () => {
    render(<Picker initial="deleted" />)
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('')
  })
})

describe('deleteTheme', () => {
  it('puts games that used the theme back on the app theme', async () => {
    const own = duplicateTheme(pub, 'Mine')
    await act(() => saveTheme(own))
    const game = { id: 'g1', name: 'G', themeId: own.id } as Game
    const other = { id: 'g2', name: 'H', themeId: 'pub' } as Game
    await act(() => db.games.bulkPut([game, other]))
    await act(() => deleteTheme(own.id))
    expect((await db.games.get('g1'))?.themeId).toBeNull()
    expect((await db.games.get('g2'))?.themeId).toBe('pub')
  })
})
