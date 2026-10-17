import type { LayoutTarget, WidgetType } from '@/db'
import { WIDGET_TYPES } from '@/db'
import { WIDGET_REGISTRY } from '@/widgets/registry'
import { WIDGET_DRAG_TYPE } from './DesignerCanvas'

interface WidgetPaletteProps {
  target: LayoutTarget
  /** Add a widget of `type` below the others. */
  onAdd: (type: WidgetType) => void
}

/**
 * The widgets that can go on `target`. Drag one onto the canvas to place it, or click it
 * to add it below the others.
 */
export function WidgetPalette({ target, onAdd }: WidgetPaletteProps) {
  const types = WIDGET_TYPES.filter(t => WIDGET_REGISTRY[t].allowedTargets.includes(target))
  return (
    <section aria-labelledby="palette-heading" className="flex flex-col gap-2">
      <h2 id="palette-heading" className="text-xs font-semibold uppercase text-(--color-muted)">
        Widgets
      </h2>
      <ul className="flex flex-col gap-1">
        {types.map(type => (
          <li key={type}>
            <button
              type="button"
              draggable
              onDragStart={e => {
                e.dataTransfer.setData(WIDGET_DRAG_TYPE, type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAdd(type)}
              aria-label={`Add ${WIDGET_REGISTRY[type].label}`}
              className="w-full cursor-grab rounded border border-(--color-border) bg-(--color-bg) px-3 py-1.5 text-left text-sm text-(--color-text) hover:bg-(--color-accent-subtle)"
            >
              {WIDGET_REGISTRY[type].label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
