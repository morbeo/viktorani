// @vitest-pool vmForks
import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { db } from '@/db'
import { deleteTheme, duplicateTheme, saveTheme } from '@/db/themes'
import { getSettings, setSettings } from '@/lib/app-settings'
import { BUILT_IN_THEMES } from '@/lib/theme'

beforeEach(async () => {
  localStorage.clear()
  await act(() => db.themes.clear())
})

describe('theme storage', () => {
  it('duplicates a theme with a new id and a copy name', () => {
    const copy = duplicateTheme(BUILT_IN_THEMES[0])
    expect(copy.id).not.toBe('classic')
    expect(copy.name).toBe('Classic copy')
    expect(copy.light).toEqual(BUILT_IN_THEMES[0].light)
    expect(copy.light).not.toBe(BUILT_IN_THEMES[0].light)
  })

  it('saves a valid theme and refuses a built-in id or a bad colour', async () => {
    const theme = duplicateTheme(BUILT_IN_THEMES[1], 'Mine')
    await act(() => saveTheme(theme))
    expect(await db.themes.get(theme.id)).toEqual(theme)

    await expect(saveTheme({ ...theme, id: 'classic' })).rejects.toThrow()
    await expect(saveTheme({ ...theme, light: { ...theme.light, bg: 'blue' } })).rejects.toThrow()
  })

  it('goes back to Classic when the app theme is deleted', async () => {
    const theme = duplicateTheme(BUILT_IN_THEMES[1], 'Mine')
    await act(() => saveTheme(theme))
    setSettings({ themeId: theme.id })
    await act(() => deleteTheme(theme.id))
    expect(await db.themes.count()).toBe(0)
    expect(getSettings().themeId).toBe('classic')
  })

  it('keeps the app theme when another theme is deleted', async () => {
    const a = duplicateTheme(BUILT_IN_THEMES[1], 'A')
    await act(() => saveTheme(a))
    setSettings({ themeId: 'modern' })
    await act(() => deleteTheme(a.id))
    expect(getSettings().themeId).toBe('modern')
  })
})
