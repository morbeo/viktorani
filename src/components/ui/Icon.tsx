import type { LucideIcon } from 'lucide-react'

/**
 * Thin wrapper around Lucide icons that enforces project-wide size and
 * stroke-width conventions:
 *
 *   sm (16px) — inline with text, badges, compact rows
 *   md (20px) — standalone buttons, collapsed-sidebar nav
 */

interface IconProps {
  icon: LucideIcon
  /** sm = 16px (inline), md = 20px (standalone). Default: sm */
  size?: 'sm' | 'md'
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function Icon({
  icon: LucideComponent,
  size = 'sm',
  className = '',
  'aria-hidden': ariaHidden = true,
  'aria-label': ariaLabel,
}: IconProps) {
  const px = size === 'md' ? 20 : 16
  return (
    <LucideComponent
      size={px}
      strokeWidth={1.75}
      className={className}
      aria-hidden={ariaHidden}
      aria-label={ariaLabel}
    />
  )
}
