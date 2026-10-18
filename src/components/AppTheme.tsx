import { useEffect } from 'react'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useAppTheme, useIsDark } from '@/hooks/useAppTheme'
import { themeVars } from '@/lib/theme'

/**
 * Applies the app theme to the whole document: its colours for this device's light or dark
 * mode, its fonts and its icon stroke. Renders nothing.
 *
 * @remarks
 * The variables go on `<html>` as inline custom properties, which the CSP allows (it
 * blocks injected `<style>` elements). Classic's values equal the defaults in `index.css`,
 * so the page looks right before this runs.
 */
export function AppTheme() {
  const [{ theme: mode }] = useAppSettings()
  const theme = useAppTheme()
  const dark = useIsDark(mode)

  useEffect(() => {
    const root = document.documentElement
    const vars = themeVars(theme, dark)
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name)
    }
  }, [theme, dark])

  return null
}
