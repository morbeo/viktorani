import { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'
import { FONT_KEYS, ICON_STROKES } from '@/db'
import type { FontKey, IconStroke, Theme } from '@/db'
import { ThemeSchema } from '@/db/snapshot-schema'
import { FONT_LABELS, resolveTheme } from '@/lib/theme'
import { LogoInput } from './LogoInput'
import { PaletteEditor } from './PaletteEditor'
import { ThemePreview } from './ThemePreview'

interface ThemeEditorProps {
  theme: Theme
  onChange: (theme: Theme) => void
  onSave: () => void
  onCancel: () => void
}

const FONT_OPTIONS = FONT_KEYS.map(key => ({ value: key, label: FONT_LABELS[key] }))
const STROKE_OPTIONS = ICON_STROKES.map(n => ({ value: String(n), label: String(n) }))
const FONT_ROLES = [
  { role: 'display', label: 'Headings' },
  { role: 'body', label: 'Body' },
  { role: 'mono', label: 'Monospace' },
] as const

/**
 * Edit a host theme: name, light and dark colours with contrast hints, fonts, icon stroke
 * and logos, with a live preview. Low contrast is flagged but never blocks saving.
 */
export function ThemeEditor({ theme, onChange, onSave, onCancel }: ThemeEditorProps) {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const resolved = resolveTheme({ app: theme, surface: 'admin' })
  const valid = ThemeSchema.safeParse(theme).success
  const set = (patch: Partial<Theme>) => onChange({ ...theme, ...patch })

  return (
    <div className="flex flex-col gap-5">
      <Input
        id="theme-name"
        label="Name"
        value={theme.name}
        maxLength={60}
        autoFocus
        onChange={e => set({ name: e.target.value })}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2" role="tablist" aria-label="Palette">
          {(['light', 'dark'] as const).map(m => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-xs font-medium border ${
                mode === m ? 'bg-text text-bg border-text' : 'text-muted border-border'
              }`}
            >
              {m === 'light' ? 'Light colours' : 'Dark colours'}
            </button>
          ))}
        </div>

        {mode === 'light' ? (
          <PaletteEditor
            idPrefix="theme-light"
            palette={theme.light}
            resolved={resolved.light}
            onChange={light => set({ light })}
          />
        ) : (
          <>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={theme.dark !== null}
                onChange={e => set({ dark: e.target.checked ? { ...resolved.dark } : null })}
              />
              Own dark colours
            </label>
            {theme.dark ? (
              <PaletteEditor
                idPrefix="theme-dark"
                palette={theme.dark}
                resolved={resolved.dark}
                onChange={dark => set({ dark })}
              />
            ) : (
              <p className="text-xs text-muted">
                Dark mode uses Classic&apos;s dark colours with this theme&apos;s accent.
              </p>
            )}
          </>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FONT_ROLES.map(({ role, label }) => (
          <Select
            key={role}
            id={`theme-font-${role}`}
            label={label}
            options={FONT_OPTIONS}
            value={theme.fonts[role]}
            onChange={e => set({ fonts: { ...theme.fonts, [role]: e.target.value as FontKey } })}
          />
        ))}
        <Select
          id="theme-icon-stroke"
          label="Icon stroke"
          options={STROKE_OPTIONS}
          value={String(theme.iconStroke)}
          onChange={e => set({ iconStroke: Number(e.target.value) as IconStroke })}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <LogoInput
          id="theme-logo-wordmark"
          label="Wide logo"
          hint="Headers, the projector screen and the join page"
          value={theme.logo.wordmark}
          onChange={wordmark => set({ logo: { ...theme.logo, wordmark } })}
        />
        <LogoInput
          id="theme-logo-mark"
          label="Square logo"
          hint="Compact headers"
          value={theme.logo.mark}
          onChange={mark => set({ logo: { ...theme.logo, mark } })}
        />
      </section>

      <ThemePreview theme={resolved} dark={mode === 'dark'} />

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={!valid}>
          Save theme
        </Button>
      </div>
    </div>
  )
}
