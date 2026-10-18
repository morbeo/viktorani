import { useState } from 'react'
import { GAME_PHASES } from '@/db'
import type { GamePhase, Layout, LayoutTheme } from '@/db'
import { Button } from '@/components/ui'
import { LayoutThemeSchema } from '@/db/snapshot-schema'
import { PHASE_LABELS } from './labels'

interface LayoutSettingsProps {
  layout: Layout
  onChange: (patch: Partial<Pick<Layout, 'name' | 'phase' | 'theme' | 'isActive'>>) => void
  onDelete: () => void
}

const field =
  'rounded border border-(--color-border) bg-(--color-bg) px-2 py-1 text-sm text-(--color-text)'
const labelClass = 'flex flex-col gap-1 text-xs text-(--color-muted)'

function ColourField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-(--color-muted)">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={e => onChange(e.target.checked ? '#c9a84c' : null)}
        />
        {label}
      </label>
      {value !== null && (
        <input
          type="color"
          aria-label={`${label} colour`}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-7 w-12 cursor-pointer rounded border border-(--color-border)"
        />
      )}
    </div>
  )
}

/**
 * Edits the layout itself, shown when no widget is selected: its name, the phase it is
 * for, whether it is the active one, and its theme. A theme the stored-data schema would
 * reject (say a logo that isn't a `data:image/` or `https://` URL) is not saved.
 */
export function LayoutSettings({ layout, onChange, onDelete }: LayoutSettingsProps) {
  // Typed text is kept here and saved on blur, so the live query doesn't fight the cursor
  const [name, setName] = useState(layout.name)
  const [logo, setLogo] = useState(layout.theme.logo ?? '')
  const [logoError, setLogoError] = useState<string | null>(null)
  // An undo can change them underneath; show the stored values again when it does
  const [stored, setStored] = useState({ name: layout.name, logo: layout.theme.logo })
  if (stored.name !== layout.name || stored.logo !== layout.theme.logo) {
    setStored({ name: layout.name, logo: layout.theme.logo })
    setName(layout.name)
    setLogo(layout.theme.logo ?? '')
    setLogoError(null)
  }

  function setTheme(patch: Partial<LayoutTheme>) {
    const theme = { ...layout.theme, ...patch }
    const result = LayoutThemeSchema.safeParse(theme)
    if (!result.success) return false
    onChange({ theme })
    return true
  }

  return (
    <section aria-labelledby="layout-settings-heading" className="flex flex-col gap-4">
      <h2 id="layout-settings-heading" className="text-sm font-semibold text-(--color-text)">
        Layout settings
      </h2>

      <label className={labelClass}>
        Name
        <input
          className={field}
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim()
            if (trimmed && trimmed !== layout.name) onChange({ name: trimmed })
            else setName(layout.name)
          }}
        />
      </label>

      <label className={labelClass}>
        Phase
        <select
          className={field}
          value={layout.phase ?? ''}
          onChange={e => onChange({ phase: (e.target.value || null) as GamePhase | null })}
        >
          <option value="">All phases</option>
          {GAME_PHASES.map(p => (
            <option key={p} value={p}>
              {PHASE_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-(--color-text)">
        <input
          type="checkbox"
          checked={layout.isActive}
          onChange={e => onChange({ isActive: e.target.checked })}
        />
        Active
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase text-(--color-muted)">Theme</legend>
        <ColourField
          label="Background"
          value={layout.theme.background}
          onChange={background => setTheme({ background })}
        />
        <ColourField
          label="Accent"
          value={layout.theme.accent}
          onChange={accent => setTheme({ accent })}
        />
        <label className={labelClass}>
          Text size
          <input
            type="number"
            min={0.5}
            max={2}
            step={0.1}
            className={field}
            value={layout.theme.fontScale}
            onChange={e => setTheme({ fontScale: Number(e.target.value) })}
          />
        </label>
        <label className={labelClass}>
          Logo URL
          <input
            className={field}
            placeholder="https://… or data:image/…"
            value={logo}
            onChange={e => {
              setLogo(e.target.value)
              setLogoError(null)
            }}
            onBlur={() => {
              const next = logo.trim() || null
              if (next === layout.theme.logo) return
              if (!setTheme({ logo: next })) {
                setLogoError('Use an https:// address or a data:image/ URL.')
              }
            }}
            aria-invalid={logoError !== null}
            aria-describedby={logoError ? 'logo-error' : undefined}
          />
        </label>
        {logoError && (
          <p id="logo-error" role="alert" className="text-xs text-(--color-negative)">
            {logoError}
          </p>
        )}
      </fieldset>

      <Button size="sm" variant="danger" onClick={onDelete}>
        Delete layout
      </Button>
    </section>
  )
}
