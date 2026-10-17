// @vitest-pool vmForks
// Theme picker and editor in Settings → Appearance (ADR 0022, #460).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db'
import type { Theme } from '@/db'
import ThemeSettings from '@/components/settings/theme/ThemeSettings'
import { AppTheme } from '@/components/AppTheme'
import { getSettings, setSettings } from '@/lib/app-settings'
import { BUILT_IN_THEMES } from '@/lib/theme'

const mine: Theme = {
  ...structuredClone(BUILT_IN_THEMES[1]),
  id: 'mine',
  name: 'Mine',
}

beforeEach(async () => {
  localStorage.clear()
  await act(() => db.themes.clear())
  document.documentElement.removeAttribute('style')
})

function renderSettings() {
  return render(
    <>
      <AppTheme />
      <ThemeSettings />
    </>
  )
}

describe('ThemeSettings', () => {
  it('lists the built-in themes with Classic selected', () => {
    renderSettings()
    const list = screen.getByRole('list', { name: 'Themes' })
    for (const t of BUILT_IN_THEMES) {
      expect(within(list).getByRole('button', { name: `Use ${t.name}` })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Use Classic' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.queryByRole('button', { name: 'Edit Classic' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Classic' })).not.toBeInTheDocument()
  })

  it('switches the app theme and applies it to the page', async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: 'Use Modern' }))
    expect(getSettings().themeId).toBe('modern')
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#2563eb')
    )
    expect(document.documentElement.style.getPropertyValue('--font-body')).toContain('system-ui')
    expect(document.documentElement.style.getPropertyValue('--icon-stroke')).toBe('1.5')
  })

  it('applies the dark palette when the mode is dark', async () => {
    setSettings({ theme: 'dark', themeId: 'modern' })
    renderSettings()
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#0f1115')
    )
  })

  it('duplicates a built-in theme into a new one and uses it', async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Pub' }))
    const dialog = screen.getByRole('heading', { name: 'New theme' }).closest('div')!.parentElement!
    const name = within(dialog).getByLabelText('Name')
    expect(name).toHaveValue('Pub copy')
    await userEvent.clear(name)
    await userEvent.type(name, 'Friday quiz')
    await userEvent.selectOptions(within(dialog).getByLabelText('Body'), 'inter')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save theme' }))

    await waitFor(async () => expect(await db.themes.count()).toBe(1))
    const [saved] = await db.themes.toArray()
    expect(saved).toMatchObject({ name: 'Friday quiz', fonts: { body: 'inter' } })
    expect(saved.id).not.toBe('pub')
    expect(getSettings().themeId).toBe(saved.id)
    expect(await screen.findByRole('button', { name: 'Use Friday quiz' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it("can't save a theme without a name", async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Classic' }))
    await userEvent.clear(screen.getByLabelText('Name'))
    expect(screen.getByRole('button', { name: 'Save theme' })).toBeDisabled()
  })

  it('warns about low contrast without blocking the save', async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Classic' }))
    const text = screen.getByLabelText('Text', { selector: '#theme-light-text' })
    // Colour inputs take their value through a change event
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        text,
        '#eeeeee'
      )
      text.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const contrast = screen.getByRole('list', { name: 'Contrast' })
    expect(
      within(contrast).getByText(/Text on background: .* may be hard to read/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save theme' })).toBeEnabled()
  })

  it('edits the dark palette only when the theme has its own', async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Paper' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Dark colours' }))
    expect(screen.getByText(/uses Classic's dark colours/)).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Own dark colours'))
    expect(screen.getByLabelText('Background', { selector: '#theme-dark-bg' })).toBeInTheDocument()
  })

  it('edits and deletes a host theme, falling back to Classic', async () => {
    await act(() => db.themes.put(mine))
    setSettings({ themeId: 'mine', confirmDestructive: true })
    renderSettings()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Mine' }))
    expect(screen.getByRole('heading', { name: 'Edit theme' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await userEvent.click(screen.getByRole('button', { name: 'Delete Mine' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect(await db.themes.count()).toBe(0))
    expect(getSettings().themeId).toBe('classic')
  })

  it('shrinks and stores an uploaded logo', async () => {
    const createImageBitmap = vi.fn(async () => ({ width: 1024, height: 256, close: vi.fn() }))
    vi.stubGlobal('createImageBitmap', createImageBitmap)
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,SMALL')
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)

    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Classic' }))
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('Wide logo'), file)

    expect(await screen.findByAltText('Wide logo preview')).toHaveAttribute(
      'src',
      'data:image/png;base64,SMALL'
    )
    expect(toDataURL).toHaveBeenCalledWith('image/png')
    await userEvent.click(screen.getByRole('button', { name: 'Save theme' }))
    await waitFor(async () =>
      expect((await db.themes.toArray())[0]?.logo.wordmark).toBe('data:image/png;base64,SMALL')
    )
    vi.unstubAllGlobals()
  })
})
