import { useState, type ChangeEvent } from 'react'
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
  /** Saves one setting; the page merges it into the stored config. */
  onConfig: (key: string, value: unknown) => void
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

const INPUT =
  'rounded border border-(--color-border) bg-(--color-bg) px-2 py-1 text-sm text-(--color-text)'

/**
 * A text setting, saved when the field loses focus, as the layout's logo is. A value the
 * schema rejects (say an http:// image address) stays in the field, marked as not saved.
 * While the field has focus it keeps what was typed; after that, a change from outside,
 * such as undo, replaces it.
 */
function TextConfigInput({
  field,
  value,
  onChange,
}: {
  field: Extract<ConfigField, { kind: 'text' }>
  value: unknown
  onChange: (value: unknown) => boolean
}) {
  const id = `widget-config-${field.key}`
  const errorId = `${id}-error`
  const stored = typeof value === 'string' ? value : ''
  const [draft, setDraft] = useState(stored)
  const [rejected, setRejected] = useState(false)
  const [editing, setEditing] = useState(false)
  const [seen, setSeen] = useState(stored)
  if (!editing && seen !== stored) {
    setSeen(stored)
    setDraft(stored)
    setRejected(false)
  }
  const props = {
    id,
    className: INPUT,
    value: draft,
    'aria-invalid': rejected,
    'aria-describedby': rejected ? errorId : undefined,
    onFocus: () => setEditing(true),
    onBlur: () => {
      setEditing(false)
      if (draft !== stored) setRejected(!onChange(draft))
    },
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft(e.target.value)
      setRejected(false)
    },
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex flex-col gap-1 text-xs text-(--color-muted)">
        {field.label}
        {field.multiline ? <textarea rows={4} {...props} /> : <input type="text" {...props} />}
      </label>
      {rejected && (
        <p id={errorId} role="alert" className="text-xs text-(--color-negative)">
          Not saved: this value isn&apos;t allowed.
        </p>
      )}
    </div>
  )
}

function ConfigInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField
  value: unknown
  onChange: (value: unknown) => boolean
}) {
  const id = `widget-config-${field.key}`
  if (field.kind === 'text')
    return <TextConfigInput field={field} value={value} onChange={onChange} />
  if (field.kind === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-(--color-text)">
        <input
          type="checkbox"
          checked={value === true}
          onChange={e => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    )
  }
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs text-(--color-muted)">
      {field.label}
      {field.kind === 'choice' ? (
        <select
          id={id}
          className={INPUT}
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
          className={INPUT}
          type="number"
          min={field.min}
          max={field.max}
          value={String(value ?? '')}
          onChange={e => onChange(Number(e.target.value))}
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

  /** Saves the setting when the schema accepts it; says whether it did. */
  function setConfig(key: string, value: unknown): boolean {
    if (!def.configSchema.safeParse({ ...widget.config, [key]: value }).success) return false
    onConfig(key, value)
    return true
  }

  return (
    <section aria-labelledby="inspector-heading" className="flex flex-col gap-4">
      <h2 id="inspector-heading" className="text-sm font-semibold text-(--color-text)">
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
                className="rounded border border-(--color-border) bg-(--color-bg) px-2 py-1 text-sm text-(--color-text)"
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
              key={`${widget.id}:${field.key}`}
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
