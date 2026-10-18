import { useAppSettings } from '@/hooks/useAppSettings'
import { useUserThemes } from '@/hooks/useAppTheme'
import { BUILT_IN_THEMES, findGameTheme, findTheme } from '@/lib/theme'

interface GameThemePickerProps {
  /** The game's theme id; `null` uses the app theme. */
  value: string | null | undefined
  onChange: (themeId: string | null) => void
  disabled?: boolean
}

/**
 * Chooses a game's theme (ADR 0022): the app theme, a built-in theme or one of the host's
 * own. The game master and screen show it; layout colours override it per screen.
 */
export function GameThemePicker({ value, onChange, disabled = false }: GameThemePickerProps) {
  const [{ themeId: appThemeId }] = useAppSettings()
  const userThemes = useUserThemes()
  const appTheme = findTheme(appThemeId, userThemes)
  // A deleted theme shows as the app theme, which is what the game falls back to
  const selected = findGameTheme(value, userThemes)?.id ?? ''

  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      Theme
      <select
        value={selected}
        disabled={disabled}
        onChange={e => onChange(e.target.value || null)}
        className="px-2 py-1 rounded border text-xs outline-none max-w-[12rem] border-border bg-bg text-text"
      >
        <option value="">App theme ({appTheme.name})</option>
        <optgroup label="Built in">
          {BUILT_IN_THEMES.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </optgroup>
        {userThemes.length > 0 && (
          <optgroup label="Yours">
            {userThemes.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}
