import { useState } from 'react'
import type { LayoutTarget, WidgetType } from '@/db'
import { WIDGET_TYPES } from '@/db'
import { WIDGET_REGISTRY } from '@/widgets/registry'
import { WIDGET_DRAG_TYPE } from './DesignerCanvas'
import { canPreview } from './sample-data'
import type { PreviewSample } from './sample-data'
import { WidgetPreview } from './WidgetPreview'

interface WidgetPaletteProps {
  target: LayoutTarget
  /** Data for the previews shown on hover or focus; without it, there are none. */
  sample?: PreviewSample
  /** Add a widget of `type` below the others. */
  onAdd: (type: WidgetType) => void
}

/**
 * The widgets that can go on `target`. Drag one onto the canvas to place it, or click it
 * to add it below the others. Hovering or focusing one shows a preview of it beside the
 * list, on surfaces that have sample data.
 */
export function WidgetPalette({ target, sample, onAdd }: WidgetPaletteProps) {
  const [shown, setShown] = useState<WidgetType | null>(null)
  const types = WIDGET_TYPES.filter(t => WIDGET_REGISTRY[t].allowedTargets.includes(target))
  return (
    <section aria-labelledby="palette-heading" className="flex flex-col gap-2">
      <h2 id="palette-heading" className="text-xs font-semibold uppercase text-(--color-muted)">
        Widgets
      </h2>
      <ul className="flex flex-col gap-1">
        {types.map(type => (
          <li key={type} className="relative">
            <button
              type="button"
              draggable
              onDragStart={e => {
                setShown(null)
                e.dataTransfer.setData(WIDGET_DRAG_TYPE, type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAdd(type)}
              onPointerEnter={() => setShown(type)}
              onPointerLeave={() => setShown(s => (s === type ? null : s))}
              onFocus={() => setShown(type)}
              onBlur={() => setShown(s => (s === type ? null : s))}
              aria-label={`Add ${WIDGET_REGISTRY[type].label}`}
              className="w-full cursor-grab rounded border border-(--color-border) bg-(--color-bg) px-3 py-1.5 text-left text-sm text-(--color-text) hover:bg-(--color-accent-subtle)"
            >
              {WIDGET_REGISTRY[type].label}
            </button>
            {sample && shown === type && canPreview(type, target) && (
              <div className="absolute top-0 left-full z-30 ml-2 w-64 rounded border border-(--color-border) bg-(--color-bg) p-2 shadow-lg">
                <WidgetPreview type={type} target={target} sample={sample} className="max-h-48" />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
