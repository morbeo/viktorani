import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SETTINGS_KEY, getSettings, setSettings } from '@/lib/app-settings'
import { useAppSettings } from '@/hooks/useAppSettings'
import { defaultSettings } from '@/components/game-settings/game-settings'

const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')

beforeEach(() => {
  localStorage.clear()
})

describe('app settings', () => {
  it('defaults every field', () => {
    expect(getSettings()).toEqual({
      version: 3,
      theme: 'system',
      actionMode: 'icons',
      controlSize: 'sm',
      soundMuted: false,
      soundVolume: 100,
      timerDuration: 60,
      timerAudioNotify: 'none',
      timerVisualNotify: 'none',
      timerAutoReset: 'none',
      gameDefaults: { ...defaultSettings(), tiebreakerMode: 'serverOrder' },
      confirmDestructive: true,
      joinUrlBase: '',
    })
  })

  it('keeps only an http(s) join URL base', () => {
    setSettings({ joinUrlBase: ' https://quiz.example.com/ ' })
    expect(getSettings().joinUrlBase).toBe('https://quiz.example.com/')
    for (const bad of ['javascript:alert(1)', 'ftp://host/', 'not a url']) {
      setSettings({ joinUrlBase: bad })
      expect(getSettings().joinUrlBase).toBe('')
    }
  })

  it('upgrades a version 2 entry with the built-in game defaults', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, soundVolume: 40 }))
    expect(getSettings()).toEqual(
      expect.objectContaining({
        version: 3,
        soundVolume: 40,
        gameDefaults: { ...defaultSettings(), tiebreakerMode: 'serverOrder' },
      })
    )
  })

  it('falls back game default by game default on invalid values', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        version: 3,
        gameDefaults: { scoringEnabled: false, maxPerTeam: -1, tiebreakerMode: 'random' },
      })
    )
    expect(getSettings().gameDefaults).toEqual({
      ...defaultSettings(),
      scoringEnabled: false,
      tiebreakerMode: 'serverOrder',
    })
  })

  it('upgrades a version 1 entry with defaults for the new fields', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: 1, theme: 'dark', actionMode: 'text', controlSize: 'lg' })
    )
    expect(getSettings()).toEqual(
      expect.objectContaining({ version: 3, theme: 'dark', soundVolume: 100, timerDuration: 60 })
    )
  })

  it('rejects out-of-range sound and timer values', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ soundVolume: 150, timerDuration: 0, timerAutoReset: 'never' })
    )
    expect(getSettings()).toEqual(
      expect.objectContaining({ soundVolume: 100, timerDuration: 60, timerAutoReset: 'none' })
    )
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
