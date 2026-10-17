import { useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, PointerEvent } from 'react'
import type { GridRect, LayoutBreakpoint, Widget, WidgetType } from '@/db'
import { GRID_COLUMNS, resolveRect } from '@/lib/layout-grid'
import { moveRect, pixelsToCells, pointToCell, resizeRect } from '@/lib/layout-designer'
import { WIDGET_REGISTRY } from '@/widgets/registry'

/** Height of one grid row on the canvas, in pixels; matches `auto-rows-[48px]`. */
export const CANVAS_ROW_HEIGHT = 48

/** MIME type a palette item carries while it is dragged onto the canvas. */
export const WIDGET_DRAG_TYPE = 'application/x-viktorani-widget'

interface DesignerCanvasProps {
  widgets: Widget[]
  /** Device class whose placement is shown and edited; `null` is the base grid. */
  breakpoint: LayoutBreakpoint | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** A widget was dragged or resized to `rect` on the current device. */
  onPlace: (widget: Widget, rect: GridRect) => void
  /** A palette item was dropped on cell (`x`, `y`). */
  onDropNew: (type: WidgetType, cell: { x: number; y: number }) => void
  /** Delete or Backspace on a widget. */
  onDelete: (widget: Widget) => void
  /** Ctrl+D (⌘D) on a widget. */
  onDuplicate: (widget: Widget) => void
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** Where `rect` is, as a screen reader hears it after a keyboard move. */
function describeRect(label: string, { x, y, w, h }: GridRect): string {
  return `${label}: column ${x + 1}, row ${y + 1}, ${w} wide, ${h} high`
}

interface Gesture {
  id: string
  kind: 'move' | 'resize'
  startX: number
  startY: number
  start: GridRect
  rect: GridRect
}

/**
 * The editing canvas: each widget as a labelled box on the 12-column grid. Drag a box to
 * move it, drag its corner to resize it, click it to select it, and drop palette items on
 * an empty spot to add them. Positions snap to whole cells and stay on the grid; the move
 * is saved when the pointer is released.
 *
 * From the keyboard: arrow keys move the focused widget one cell, Shift+arrows resize it,
 * Ctrl+D (⌘D) duplicates it and Delete removes it. Each move is announced.
 */
export function DesignerCanvas({
  widgets,
  breakpoint,
  selectedId,
  onSelect,
  onPlace,
  onDropNew,
  onDelete,
  onDuplicate,
}: DesignerCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const [announcement, setAnnouncement] = useState('')

  function handleKey(e: KeyboardEvent, widget: Widget) {
    const label = WIDGET_REGISTRY[widget.type].label
    const arrow = ARROWS[e.key]
    if (arrow && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      const start = resolveRect(widget, breakpoint)
      const [dx, dy] = arrow
      const rect = e.shiftKey ? resizeRect(start, dx, dy) : moveRect(start, dx, dy)
      onSelect(widget.id)
      setAnnouncement(describeRect(label, rect))
      if (rect.x !== start.x || rect.y !== start.y || rect.w !== start.w || rect.h !== start.h) {
        onPlace(widget, rect)
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(widget.id)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      setAnnouncement(`${label} removed`)
      onDelete(widget)
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      setAnnouncement(`${label} duplicated`)
      onDuplicate(widget)
    }
  }

  const cellWidth = () => (canvasRef.current?.getBoundingClientRect().width ?? 0) / GRID_COLUMNS

  function begin(e: PointerEvent, widget: Widget, kind: Gesture['kind']) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const start = resolveRect(widget, breakpoint)
    onSelect(widget.id)
    setGesture({ id: widget.id, kind, startX: e.clientX, startY: e.clientY, start, rect: start })
  }

  function track(e: PointerEvent) {
    if (!gesture) return
    const { dx, dy } = pixelsToCells(
      e.clientX - gesture.startX,
      e.clientY - gesture.startY,
      cellWidth(),
      CANVAS_ROW_HEIGHT
    )
    const rect =
      gesture.kind === 'move' ? moveRect(gesture.start, dx, dy) : resizeRect(gesture.start, dx, dy)
    setGesture({ ...gesture, rect })
  }

  function end() {
    if (!gesture) return
    const widget = widgets.find(w => w.id === gesture.id)
    const { rect, start } = gesture
    setGesture(null)
    const moved =
      rect.x !== start.x || rect.y !== start.y || rect.w !== start.w || rect.h !== start.h
    if (widget && moved) onPlace(widget, rect)
  }

  function handleDrop(e: DragEvent) {
    const type = e.dataTransfer.getData(WIDGET_DRAG_TYPE) as WidgetType
    if (!(type in WIDGET_REGISTRY)) return
    e.preventDefault()
    const box = e.currentTarget.getBoundingClientRect()
    onDropNew(
      type,
      pointToCell(e.clientX - box.left, e.clientY - box.top, cellWidth(), CANVAS_ROW_HEIGHT)
    )
  }

  const rows = widgets.reduce((max, w) => {
    const r = gesture?.id === w.id ? gesture.rect : resolveRect(w, breakpoint)
    return Math.max(max, r.y + r.h)
  }, 0)

  return (
    <div
      ref={canvasRef}
      role="application"
      aria-label="Layout canvas"
      className="relative grid grid-cols-12 auto-rows-[48px] gap-0 rounded border border-dashed border-(--color-border) bg-(--color-bg) min-h-96 select-none"
      onPointerDown={() => onSelect(null)}
      onPointerMove={track}
      onPointerUp={end}
      onPointerCancel={() => setGesture(null)}
      onDragOver={e => {
        if (e.dataTransfer.types.includes(WIDGET_DRAG_TYPE)) e.preventDefault()
      }}
      onDrop={handleDrop}
    >
      {/* Column guides */}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-12">
        {Array.from({ length: GRID_COLUMNS }, (_, i) => (
          <div key={i} className="border-r border-(--color-border)/40 last:border-r-0" />
        ))}
      </div>
      {/* An extra row below the widgets, so there's always room to drop or drag into */}
      <div aria-hidden style={{ gridRow: `${rows + 1} / span 2`, gridColumn: '1 / -1' }} />
      {[...widgets]
        .sort((a, b) => a.order - b.order)
        .map(widget => {
          const rect = gesture?.id === widget.id ? gesture.rect : resolveRect(widget, breakpoint)
          const label = WIDGET_REGISTRY[widget.type].label
          const selected = widget.id === selectedId
          const overridden = breakpoint !== null && !!widget.breakpoints[breakpoint]
          return (
            <div
              key={widget.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${label} widget`}
              data-widget-id={widget.id}
              onPointerDown={e => begin(e, widget, 'move')}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowRight Shift+ArrowDown Control+D Delete"
              onKeyDown={e => handleKey(e, widget)}
              className={`relative z-10 m-0.5 flex items-center justify-center rounded border-2 text-sm font-medium cursor-move touch-none ${
                selected
                  ? 'border-(--color-accent) bg-(--color-accent-subtle)'
                  : 'border-(--color-border) bg-(--color-surface)'
              }`}
              style={{
                gridColumn: `${rect.x + 1} / span ${rect.w}`,
                gridRow: `${rect.y + 1} / span ${rect.h}`,
              }}
            >
              <span className="truncate px-2 text-(--color-text)">
                {label}
                {overridden && <span className="text-(--color-muted)"> · own placement</span>}
              </span>
              <span
                aria-hidden
                onPointerDown={e => begin(e, widget, 'resize')}
                className="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize rounded-tl bg-(--color-border)"
              />
            </div>
          )
        })}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
