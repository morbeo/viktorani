// @vitest-pool vmForks
// Host themes in backups (ADR 0022): exported, validated, and restored; built-ins are never stored.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { db } from '@/db'
import type { Theme } from '@/db'
import { exportDatabase, importDatabase } from '@/db/snapshot'
import { getSettings, setSettings } from '@/lib/app-settings'
import { BUILT_IN_THEMES } from '@/lib/theme'

const THEME: Theme = {
  id: 't1',
  name: 'Quiz Night',
  light: { ...BUILT_IN_THEMES[0].light, accent: '#aa3366', onAccent: null },
  dark: null,
  fonts: { display: 'system-sans', body: 'lora', mono: 'dm-mono' },
  iconStroke: 2,
  logo: { wordmark: 'data:image/png;base64,AAAA', mark: null },
}

function jsonFile(value: unknown) {
  return new File([JSON.stringify(value)], 'backup.json', { type: 'application/json' })
}

async function captureExport(): Promise<Record<string, unknown>> {
  let captured: Blob | null = null
  ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementationOnce((blob: Blob) => {
    captured = blob
    return 'blob:captured'
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await exportDatabase()
  return JSON.parse(await (captured as unknown as Blob).text())
}

beforeEach(async () => {
  await db.themes.clear()
  localStorage.clear()
})

describe('backups — themes', () => {
  it('exports only the host themes', async () => {
    await act(() => db.themes.put(THEME))
    const exported = await captureExport()
    expect(exported.themes).toEqual([THEME])
  })

  it('round-trips themes and the chosen theme id', async () => {
    await act(() => db.themes.put(THEME))
    setSettings({ themeId: 't1' })
    const exported = await captureExport()
    await act(() => db.themes.clear())
    setSettings({ themeId: 'classic' })

    await act(() => importDatabase(jsonFile(exported)))

    expect(await db.themes.toArray()).toEqual([THEME])
    expect(getSettings().themeId).toBe('t1')
  })

  it('imports an older backup with no themes', async () => {
    await act(() => importDatabase(jsonFile({ version: 2, exportedAt: 1 })))
    expect(await db.themes.count()).toBe(0)
  })

  it.each([
    ['a built-in id', { id: 'classic' }, /themes\.0\.id/],
    ['a bad colour', { light: { ...THEME.light, bg: 'red' } }, /themes\.0\.light\.bg/],
    [
      'an unknown font',
      { fonts: { ...THEME.fonts, body: 'comic-sans' } },
      /themes\.0\.fonts\.body/,
    ],
    ['an unknown stroke', { iconStroke: 3 }, /themes\.0\.iconStroke/],
    [
      'an unsafe logo',
      { logo: { wordmark: 'javascript:alert(1)', mark: null } },
      /themes\.0\.logo/,
    ],
  ])('rejects a file with %s and writes nothing', async (_label, patch, message) => {
    const file = jsonFile({ version: 2, exportedAt: 1, themes: [{ ...THEME, ...patch }] })
    await expect(importDatabase(file)).rejects.toThrow(message)
    expect(await db.themes.count()).toBe(0)
  })
})
