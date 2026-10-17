import type { ReactNode } from 'react'
import { useAppTheme } from '@/hooks/useAppTheme'

interface ThemeLogoProps {
  /** `wordmark` for full-width places, `mark` for compact ones. */
  kind: 'wordmark' | 'mark'
  className?: string
  /** Shown when the page's theme has no such logo. */
  fallback?: ReactNode
}

/**
 * The page theme's logo (ADR 0022): the app theme's, the open game's, or the one a host
 * sent. Logos are `data:image/` or `https://` URLs, checked when the theme is saved or
 * received, so they go straight into `src`.
 */
export function ThemeLogo({ kind, className = '', fallback = null }: ThemeLogoProps) {
  const theme = useAppTheme()
  const src = theme.logo[kind]
  if (!src) return <>{fallback}</>
  return <img src={src} alt={`${theme.name} logo`} className={`object-contain ${className}`} />
}
