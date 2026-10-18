import { THEME_TOKENS } from '@/db'
import type { ThemePalette, ThemeToken } from '@/db'
import { contrastRatio } from '@/lib/contrast'
import type { ResolvedPalette } from '@/lib/theme'
import { CONTRAST_CHECKS, MIN_CONTRAST, TOKEN_LABELS } from './theme-labels'

interface PaletteEditorProps {
  /** The palette as stored; `onAccent: null` means automatic. */
  palette: ThemePalette
  /** The same palette with `onAccent` filled in, for the pickers and contrast checks. */
  resolved: ResolvedPalette
  /** Prefix for input ids, so two editors on a page don't clash. */
  idPrefix: string
  onChange: (palette: ThemePalette) => void
}

/** A colour picker per token, an automatic option for text on accent, and contrast hints. */
export function PaletteEditor({ palette, resolved, idPrefix, onChange }: PaletteEditorProps) {
  const set = (token: ThemeToken, value: string | null) => onChange({ ...palette, [token]: value })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {THEME_TOKENS.map(token => {
          const id = `${idPrefix}-${token}`
          const auto = token === 'onAccent' && palette.onAccent === null
          return (
            <div key={token} className="flex items-center gap-2">
              <input
                id={id}
                type="color"
                value={resolved[token]}
                disabled={auto}
                onChange={e => set(token, e.target.value)}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border bg-transparent border-border disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="min-w-0">
                <label htmlFor={id} className="block truncate text-xs font-medium">
                  {TOKEN_LABELS[token]}
                </label>
                {token === 'onAccent' ? (
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={auto}
                      onChange={e => set('onAccent', e.target.checked ? null : resolved.onAccent)}
                    />
                    Automatic
                  </label>
                ) : (
                  <span className="text-xs font-mono text-muted">{resolved[token]}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ul className="flex flex-col gap-1 text-xs" aria-label="Contrast">
        {CONTRAST_CHECKS.map(({ fg, bg, label }) => {
          const ratio = contrastRatio(resolved[fg], resolved[bg]) ?? 0
          const low = ratio < MIN_CONTRAST
          return (
            <li key={label} className={low ? 'text-negative' : 'text-muted'}>
              {label}: {ratio.toFixed(1)}:1{low && ' — may be hard to read'}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
