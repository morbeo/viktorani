import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Redo2, Undo2 } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { Button, Modal } from '@/components/ui'
import { db } from '@/db'
import type { GridRect, Layout, LayoutBreakpoint, Widget, WidgetType } from '@/db'
import {
  addWidget,
  copyLayout,
  createLayout,
  deleteLayout,
  deleteWidget,
  duplicateWidget,
  loadLayoutBundle,
  reorderWidgets,
  updateLayout,
  updateWidget,
  updateWidgetConfig,
} from '@/db/layout-editor'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useLayoutHistory } from '@/hooks/useLayoutHistory'
import { clampRect, nextFreeRect, rectsOn, swapOrder } from '@/lib/layout-designer'
import { BUILTIN_LAYOUTS } from '@/widgets/layouts'
import { WIDGET_REGISTRY } from '@/widgets/registry'
import { DesignerCanvas } from '@/components/layout-designer/DesignerCanvas'
import { LayoutPreview } from '@/components/layout-designer/LayoutPreview'
import { LayoutSettings } from '@/components/layout-designer/LayoutSettings'
import { PHASE_LABELS, TARGET_LABELS } from '@/components/layout-designer/labels'
import { LayoutCopies } from '@/components/layout-designer/LayoutCopies'
import { NewLayoutForm } from '@/components/layout-designer/NewLayoutForm'
import type { LayoutSource } from '@/components/layout-designer/NewLayoutForm'
import { WidgetInspector } from '@/components/layout-designer/WidgetInspector'
import { WidgetPalette } from '@/components/layout-designer/WidgetPalette'

type Device = 'phone' | 'tablet' | 'tv'

const DEVICES: { id: Device; label: string; breakpoint: LayoutBreakpoint | null; width: string }[] =
  [
    { id: 'phone', label: 'Phone', breakpoint: 'phone', width: 'max-w-[390px]' },
    { id: 'tablet', label: 'Tablet', breakpoint: null, width: 'max-w-[820px]' },
    { id: 'tv', label: 'TV (16:9)', breakpoint: 'tv', width: 'max-w-[1280px]' },
  ]

const BUILTIN_SOURCES: LayoutSource[] = BUILTIN_LAYOUTS.map(({ layout }) => ({
  id: layout.id,
  label: `Built-in default${layout.phase ? ` (${PHASE_LABELS[layout.phase]})` : ''}`,
  target: layout.target,
}))

/** Whether a key press is meant for a text field, which has its own undo. */
function inField(e: KeyboardEvent) {
  const el = e.target
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))
  )
}

const tab = (on: boolean) =>
  `px-3 py-1 text-sm ${on ? 'bg-(--color-text) text-(--color-bg)' : 'text-(--color-muted)'}`

/**
 * The layout designer (#412): global templates at `/admin/layouts`, a game's own layouts at
 * `/admin/layouts/:gameId`. Pick or create a layout, place widgets from the palette on the
 * canvas, drag and resize them, edit the selected one in the inspector, and switch device
 * or to a live preview with sample data. Every change is saved as it is made, and can be
 * undone (#413). New layouts can start from a built-in default or a template, and layouts
 * can be duplicated, saved as templates or copied into a game.
 */
export default function Layouts() {
  const { gameId = null } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const [{ confirmDestructive }] = useAppSettings()
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [device, setDevice] = useState<Device>('tablet')
  const [preview, setPreview] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const games = useLiveQuery(() => db.games.orderBy('createdAt').reverse().toArray(), [])
  const layouts = useLiveQuery(
    () =>
      db.layouts
        .filter(l => l.gameId === gameId)
        .toArray()
        .then(ls => ls.sort((a, b) => a.order - b.order)),
    [gameId]
  )
  const layout = layouts?.find(l => l.id === chosenId) ?? layouts?.[0] ?? null
  const layoutId = layout?.id ?? null
  const widgets =
    useLiveQuery(
      () => (layoutId ? db.widgets.where('layoutId').equals(layoutId).toArray() : []),
      [layoutId]
    ) ?? []
  const ordered = [...widgets].sort((a, b) => a.order - b.order)
  const selected = widgets.find(w => w.id === selectedWidgetId) ?? null
  const { breakpoint, width } = DEVICES.find(d => d.id === device)!
  const { edit, undo, redo, canUndo, canRedo } = useLayoutHistory(layoutId)
  // In a game's scope, its new layouts can also start from a template
  const templates =
    useLiveQuery(
      () => (gameId ? db.layouts.filter(l => l.gameId === null).sortBy('order') : []),
      [gameId]
    ) ?? []
  const sources: LayoutSource[] = [
    ...templates.map(l => ({ id: l.id, label: `Template: ${l.name}`, target: l.target })),
    ...BUILTIN_SOURCES,
  ]

  function chooseLayout(id: string) {
    setChosenId(id)
    setSelectedWidgetId(null)
  }

  function place(widget: Widget, rect: GridRect) {
    void edit(() =>
      updateWidget(
        widget.id,
        breakpoint ? { breakpoints: { ...widget.breakpoints, [breakpoint]: rect } } : { grid: rect }
      )
    )
  }

  function removeWidget(widget: Widget) {
    if (widget.id === selectedWidgetId) setSelectedWidgetId(null)
    void edit(() => deleteWidget(widget.id))
  }

  function duplicate(widget: Widget) {
    void edit(async () => {
      const copy = await duplicateWidget(widget.id)
      if (copy) setSelectedWidgetId(copy.id)
    })
  }

  async function create(input: {
    name: string
    target: Layout['target']
    phase: Layout['phase']
    sourceId: string | null
  }) {
    const { sourceId, ...rest } = input
    const source = sourceId
      ? (BUILTIN_LAYOUTS.find(b => b.layout.id === sourceId) ?? (await loadLayoutBundle(sourceId)))
      : null
    const created = source
      ? await copyLayout(source, { gameId, name: rest.name, phase: rest.phase })
      : await createLayout({ gameId, ...rest })
    chooseLayout(created.id)
  }

  async function copyTo(target: string | null, newScope: boolean) {
    if (!layout) return
    const bundle = await loadLayoutBundle(layout.id)
    if (!bundle) return
    const name = newScope ? layout.name : `${layout.name} (copy)`
    const copy = await copyLayout(bundle, { gameId: target, name })
    if (!newScope) chooseLayout(copy.id)
  }

  // On the window, since an undo can remove the focused widget and leave focus on the page
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || inField(e)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        void undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        void redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  async function add(type: WidgetType, cell?: { x: number; y: number }) {
    if (!layout) return
    const { preferredSize, defaultConfig } = WIDGET_REGISTRY[type]
    const grid = cell
      ? clampRect({ ...cell, ...preferredSize })
      : nextFreeRect(rectsOn(widgets, breakpoint), preferredSize)
    await edit(async () => {
      const widget = await addWidget({ layoutId: layout.id, type, grid, config: defaultConfig })
      setSelectedWidgetId(widget.id)
    })
  }

  async function removeLayout() {
    if (!layout) return
    setConfirmingDelete(false)
    setChosenId(null)
    setSelectedWidgetId(null)
    await deleteLayout(layout.id)
  }

  const gameName = games?.find(g => g.id === gameId)?.name

  return (
    <AdminLayout title="Layouts">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-(--color-muted)">
            Layouts for
            <select
              className="rounded border border-(--color-border) bg-(--color-bg) px-2 py-1 text-sm text-(--color-text)"
              value={gameId ?? ''}
              onChange={e => {
                setChosenId(null)
                setSelectedWidgetId(null)
                navigate(e.target.value ? `/admin/layouts/${e.target.value}` : '/admin/layouts')
              }}
            >
              <option value="">Templates (any game)</option>
              {games?.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-(--color-muted)">
            {gameId
              ? `Only ${gameName ?? 'this game'} uses these; they win over templates.`
              : 'Every game uses these unless it has its own.'}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[14rem_1fr_16rem]">
          {/* Layout list and palette */}
          <aside className="flex flex-col gap-6">
            <section aria-labelledby="layout-list-heading" className="flex flex-col gap-2">
              <h2
                id="layout-list-heading"
                className="text-xs font-semibold uppercase text-(--color-muted)"
              >
                Layouts
              </h2>
              {layouts?.length === 0 && (
                <p className="text-xs text-(--color-muted)">
                  None yet: each surface uses its built-in default.
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {layouts?.map(l => (
                  <li key={l.id}>
                    <button
                      type="button"
                      aria-current={l.id === layoutId}
                      onClick={() => chooseLayout(l.id)}
                      className={`w-full rounded px-3 py-1.5 text-left text-sm ${
                        l.id === layoutId
                          ? 'bg-(--color-accent-subtle) font-semibold text-(--color-text)'
                          : 'text-(--color-text) hover:bg-black/5'
                      }`}
                    >
                      {l.name}
                      <span className="block text-xs font-normal text-(--color-muted)">
                        {TARGET_LABELS[l.target]} · {l.phase ? PHASE_LABELS[l.phase] : 'All phases'}
                        {!l.isActive && ' · inactive'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <NewLayoutForm sources={sources} onCreate={input => void create(input)} />
            </section>
            {layout && <WidgetPalette target={layout.target} onAdd={type => void add(type)} />}
          </aside>

          {/* Canvas */}
          <section aria-label="Canvas" className="flex min-w-0 flex-col gap-3">
            {layout ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    role="group"
                    aria-label="Device"
                    className="flex overflow-hidden rounded border border-(--color-border)"
                  >
                    {DEVICES.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={device === d.id}
                        onClick={() => setDevice(d.id)}
                        className={tab(device === d.id)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div
                    role="group"
                    aria-label="View"
                    className="flex overflow-hidden rounded border border-(--color-border)"
                  >
                    <button
                      type="button"
                      aria-pressed={!preview}
                      onClick={() => setPreview(false)}
                      className={tab(!preview)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-pressed={preview}
                      onClick={() => setPreview(true)}
                      className={tab(preview)}
                    >
                      Preview
                    </button>
                  </div>
                  <div role="group" aria-label="History" className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canUndo}
                      aria-keyshortcuts="Control+Z"
                      onClick={() => void undo()}
                    >
                      <Undo2 size={14} aria-hidden /> Undo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canRedo}
                      aria-keyshortcuts="Control+Shift+Z Control+Y"
                      onClick={() => void redo()}
                    >
                      <Redo2 size={14} aria-hidden /> Redo
                    </Button>
                  </div>
                </div>
                <div className={`w-full ${width}`}>
                  {preview ? (
                    <LayoutPreview
                      layout={layout}
                      widgets={widgets}
                      breakpoint={breakpoint}
                      gameId={gameId}
                    />
                  ) : (
                    <DesignerCanvas
                      widgets={widgets}
                      breakpoint={breakpoint}
                      selectedId={selectedWidgetId}
                      onSelect={setSelectedWidgetId}
                      onPlace={place}
                      onDropNew={(type, cell) => void add(type, cell)}
                      onDelete={removeWidget}
                      onDuplicate={duplicate}
                    />
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-(--color-muted)">
                Create a layout to start placing widgets.
              </p>
            )}
          </section>

          {/* Inspector */}
          <aside>
            {selected ? (
              <WidgetInspector
                key={selected.id}
                widget={selected}
                breakpoint={breakpoint}
                isFirst={ordered[0]?.id === selected.id}
                isLast={ordered.at(-1)?.id === selected.id}
                onPlace={rect => place(selected, rect)}
                onResetPlacement={() => {
                  if (!breakpoint) return
                  const rest = { ...selected.breakpoints }
                  delete rest[breakpoint]
                  void edit(() => updateWidget(selected.id, { breakpoints: rest }))
                }}
                onConfig={(key, value) =>
                  void edit(() => updateWidgetConfig(selected.id, { [key]: value }))
                }
                onMove={dir =>
                  void edit(() => reorderWidgets(swapOrder(widgets, selected.id, dir)))
                }
                onDuplicate={() => duplicate(selected)}
                onDelete={() => removeWidget(selected)}
              />
            ) : (
              layout && (
                <div className="flex flex-col gap-6">
                  <LayoutSettings
                    key={layout.id}
                    layout={layout}
                    onChange={patch => void edit(() => updateLayout(layout.id, patch))}
                    onDelete={() =>
                      confirmDestructive ? setConfirmingDelete(true) : void removeLayout()
                    }
                  />
                  <LayoutCopies
                    key={`copies-${layout.id}`}
                    gameId={gameId}
                    games={games ?? []}
                    onDuplicate={() => void copyTo(gameId, false)}
                    onCopyTo={target => copyTo(target, true)}
                  />
                </div>
              )
            )}
          </aside>
        </div>
      </div>

      <Modal
        open={confirmingDelete}
        title="Delete layout"
        onClose={() => setConfirmingDelete(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-(--color-text)">
            Delete <strong>{layout?.name}</strong> and its widgets? Surfaces that used it go back to
            the next best layout or their built-in default.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void removeLayout()}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
