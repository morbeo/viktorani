import { Monitor, Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from '@/components/ui'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { ThemeMode } from '@/lib/app-settings'

const MODES: Array<{ mode: ThemeMode; label: string; icon: LucideIcon }> = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'Follow device', icon: Monitor },
]

/**
 * Light, dark or the device's setting, for this device only. Players and screens use it
 * to pick a palette of the host's theme, which carries both.
 */
export function ModeSwitch() {
  const [{ theme: mode }, update] = useAppSettings()
  return (
    <div
      role="radiogroup"
      aria-label="Light or dark"
      className="inline-flex rounded-full border overflow-hidden shrink-0 border-border"
    >
      {MODES.map(m => {
        const on = m.mode === mode
        return (
          <button
            key={m.mode}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={m.label}
            title={m.label}
            onClick={() => update({ theme: m.mode })}
            className={`p-1.5 transition-colors ${on ? 'bg-accent text-on-accent' : 'text-muted'}`}
          >
            <Icon icon={m.icon} size="sm" />
          </button>
        )
      })}
    </div>
  )
}
