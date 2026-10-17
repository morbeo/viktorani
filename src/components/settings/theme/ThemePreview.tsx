import { CircleCheck, CircleX, Trophy } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Icon } from '@/components/ui'
import { themeVars } from '@/lib/theme'
import type { ResolvedTheme } from '@/lib/theme'

/**
 * A small mock of the app in `theme`, for the editor. The theme's variables are set on its
 * root only, so the rest of the page keeps the current theme.
 */
export function ThemePreview({ theme, dark }: { theme: ResolvedTheme; dark: boolean }) {
  const logo = theme.logo.wordmark ?? theme.logo.mark
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-4 bg-bg text-text border-border font-body"
      style={themeVars(theme, dark) as CSSProperties}
      aria-label="Theme preview"
    >
      <div className="flex items-center gap-2">
        {logo && <img src={logo} alt="" className="max-h-8 max-w-32 object-contain" />}
        <h4 className="text-lg font-bold font-display">{theme.name || 'Untitled'}</h4>
      </div>
      <div className="rounded border p-3 bg-surface border-border">
        <p className="text-sm">Which planet is known as the Red Planet?</p>
        <p className="text-xs text-muted">Round 2 · Science</p>
        <p className="mt-2 text-xs font-mono text-muted">ROOM 4F2K</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded px-2 py-1 font-semibold bg-accent text-on-accent">Buzz in</span>
        <span className="rounded px-2 py-1 bg-accent-subtle">Team Owls</span>
        <span className="flex items-center gap-1 text-positive">
          <Icon icon={CircleCheck} size="sm" /> Correct
        </span>
        <span className="flex items-center gap-1 text-negative">
          <Icon icon={CircleX} size="sm" /> Wrong
        </span>
        <span className="flex items-center gap-1 text-accent">
          <Icon icon={Trophy} size="sm" /> 120
        </span>
      </div>
    </div>
  )
}
