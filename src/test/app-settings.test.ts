import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SETTINGS_KEY, getSettings, setSettings } from '@/lib/app-settings'
import { useAppSettings } from '@/hooks/useAppSettings'

const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')

beforeEach(() => {
  localStorage.clear()
})

describe('app settings', () => {
  it('defaults every field', () => {
    expect(getSettings()).toEqual({
      version: 1,
      theme: 'system',
      actionMode: 'icons',
      controlSize: 'sm',
    })
  })

  it('migrates the old keys once and removes them', () => {
    localStorage.setItem('app-theme', 'dark')
    localStorage.setItem('action-mode', '"text"')
    localStorage.setItem('gm-control-size', '"lg"')
    expect(getSettings()).toEqual(
      expect.objectContaining({ theme: 'dark', actionMode: 'text', controlSize: 'lg' })
    )
    expect(stored()).toEqual(expect.objectContaining({ theme: 'dark' }))
    expect(localStorage.getItem('app-theme')).toBeNull()
    expect(localStorage.getItem('action-mode')).toBeNull()
    expect(localStorage.getItem('gm-control-size')).toBeNull()
  })

  it('falls back field by field on invalid values', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'neon', actionMode: 'text' }))
    expect(getSettings()).toEqual(
      expect.objectContaining({ theme: 'system', actionMode: 'text', controlSize: 'sm' })
    )
  })

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json')
    expect(getSettings().theme).toBe('system')
  })

  it('returns the same object until the entry changes', () => {
    const first = getSettings()
    expect(getSettings()).toBe(first)
    setSettings({ theme: 'light' })
    expect(getSettings()).not.toBe(first)
  })

  it('persists a patch and applies the theme', () => {
    setSettings({ theme: 'dark' })
    expect(stored()).toEqual(expect.objectContaining({ theme: 'dark', actionMode: 'icons' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('re-renders hook users on change', () => {
    const { result } = renderHook(() => useAppSettings())
    act(() => result.current[1]({ controlSize: 'md' }))
    expect(result.current[0].controlSize).toBe('md')
  })
})
