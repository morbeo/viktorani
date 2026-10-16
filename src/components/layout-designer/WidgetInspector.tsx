import type { GridRect, LayoutBreakpoint, Widget } from '@/db'
import { Button } from '@/components/ui'
import { resolveRect } from '@/lib/layout-grid'
import { clampRect, configFields, type ConfigField } from '@/lib/layout-designer'
import { WIDGET_REGISTRY } from '@/widgets/registry'

const DEVICE_NAMES: Record<LayoutBreakpoint, string> = { phone: 'phones', tv: 'TVs' }

interface WidgetInspectorProps {
  widget: Widget
  breakpoint: LayoutBreakpoint | null
  isFirst: boolean
  isLast: boolean
  onPlace: (rect: GridRect) => void
  onResetPlacement: () => void
  onConfig: (config: Record<string, unknown>) => void
  onMove: (dir: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
}

/** Shown 1-based, as people count columns and rows; stored 0-based. */
const PLACEMENT: { key: keyof GridRect; label: string; offset: number }[] = [
  { key: 'x', label: 'Column', offset: 1 },
  { key: 'y', label: 'Row', offset: 1 },
  { key: 'w', label: 'Width', offset: 0 },
  { key: 'h', label: 'Height', offset: 0 },
]

function ConfigInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField
  value: unknown
  onChange: (value: unknown) => void
}) {
  const id = `widget-config-${field.key}`
  const input =
    'rounded border border-(--color-border) bg-(--color-cream) px-2 py-1 text-sm text-(--color-ink)'
  if (field.kind === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-(--color-ink)">
        <input
          type="checkbox"
          checked={value === true}
          onChange={e => onChange(e.target.checked)}
        />
        {field.key}
      </label>
    )
  }
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs text-(--color-muted)">
      {field.key}
      {field.kind === 'choice' ? (
        <select
          id={id}
          className={input}
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
        >
          {field.options.map(o => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className={input}
          type={field.kind === 'number' ? 'number' : 'text'}
          min={field.kind === 'number' ? field.min : undefined}
          max={field.kind === 'number' ? field.max : undefined}
          value={String(value ?? '')}
          onChange={e =>
            onChange(field.kind === 'number' ? Number(e.target.value) : e.target.value)
          }
        />
      )}
    </label>
  )
}

/**
 * Edits the selected widget: its placement on the current device (on phones and TVs as an
 * override of the base grid), its place in reading order, and its config through a form
 * generated from the widget type's schema. A config change that the schema rejects is not
 * saved.
 */
export function WidgetInspector({
  widget,
  breakpoint,
  isFirst,
  isLast,
  onPlace,
  onResetPlacement,
  onConfig,
  onMove,
  onDuplicate,
  onDelete,
}: WidgetInspectorProps) {
  const def = WIDGET_REGISTRY[widget.type]
  const rect = resolveRect(widget, breakpoint)
  const fields = configFields(def.configSchema)
  const overridden = breakpoint !== null && !!widget.breakpoints[breakpoint]

  function setConfig(key: string, value: unknown) {
    const next = { ...widget.config, [key]: value }
    if (def.configSchema.safeParse(next).success) onConfig(next)
  }

  return (
    <section aria-labelledby="inspector-heading" className="flex flex-col gap-4">
      <h2 id="inspector-heading" className="text-sm font-semibold text-(--color-ink)">
        {def.label}
      </h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase text-(--color-muted)">
          Placement{breakpoint && ` on ${DEVICE_NAMES[breakpoint]}`}
        </legend>
        {breakpoint && (
          <p className="text-xs text-(--color-muted)">
            {overridden
              ? `This widget has its own placement on ${DEVICE_NAMES[breakpoint]}.`
              : `Changes here give it its own placement on ${DEVICE_NAMES[breakpoint]}.`}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {PLACEMENT.map(({ key, label, offset }) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-(--color-muted)">
              {label}
              <input
                type="number"
                min={1}
                value={rect[key] + offset}
                onChange={e => {
                  const n = Number(e.target.value)
                  if (!Number.isFinite(n) || e.target.value === '') return
                  onPlace(clampRect({ ...rect, [key]: n - offset }))
                }}
                className="rounded border border-(--color-border) bg-(--color-cream) px-2 py-1 text-sm text-(--color-ink)"
              />
            </label>
          ))}
        </div>
        {overridden && (
          <Button size="sm" variant="ghost" onClick={onResetPlacement}>
            Use the base placement
          </Button>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase text-(--color-muted)">
          Reading order
        </legend>
        <div className="flex gap-2">
          <Button size="sm" disabled={isFirst} onClick={() => onMove(-1)}>
            Earlier
          </Button>
          <Button size="sm" disabled={isLast} onClick={() => onMove(1)}>
            Later
          </Button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase text-(--color-muted)">
          Settings
        </legend>
        {fields.length === 0 ? (
          <p className="text-xs text-(--color-muted)">This widget has no settings.</p>
        ) : (
          fields.map(field => (
            <ConfigInput
              key={field.key}
              field={field}
              value={widget.config[field.key]}
              onChange={value => setConfig(field.key, value)}
            />
          ))
        )}
      </fieldset>

      <div className="flex gap-2">
        <Button size="sm" onClick={onDuplicate} aria-keyshortcuts="Control+D">
          Duplicate
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          Remove widget
        </Button>
      </div>
    </section>
  )
}
