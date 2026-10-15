import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import AdminLayout from '@/components/AdminLayout'
import { Button, Modal } from '@/components/ui'
import { db } from '@/db'
import type { GridRect, LayoutBreakpoint, Widget, WidgetType } from '@/db'
import {
  addWidget,
  createLayout,
  deleteLayout,
  deleteWidget,
  reorderWidgets,
  updateLayout,
  updateWidget,
} from '@/db/layout-editor'
import { useAppSettings } from '@/hooks/useAppSettings'
import { clampRect, nextFreeRect, rectsOn, swapOrder } from '@/lib/layout-designer'
import { WIDGET_REGISTRY } from '@/widgets/registry'
import { DesignerCanvas } from '@/components/layout-designer/DesignerCanvas'
import { LayoutPreview } from '@/components/layout-designer/LayoutPreview'
import { LayoutSettings } from '@/components/layout-designer/LayoutSettings'
import { PHASE_LABELS, TARGET_LABELS } from '@/components/layout-designer/labels'
import { NewLayoutForm } from '@/components/layout-designer/NewLayoutForm'
import { WidgetInspector } from '@/components/layout-designer/WidgetInspector'
import { WidgetPalette } from '@/components/layout-designer/WidgetPalette'

type Device = 'phone' | 'tablet' | 'tv'

const DEVICES: { id: Device; label: string; breakpoint: LayoutBreakpoint | null; width: string }[] =
  [
    { id: 'phone', label: 'Phone', breakpoint: 'phone', width: 'max-w-[390px]' },
    { id: 'tablet', label: 'Tablet', breakpoint: null, width: 'max-w-[820px]' },
    { id: 'tv', label: 'TV (16:9)', breakpoint: 'tv', width: 'max-w-[1280px]' },
  ]

const tab = (on: boolean) =>
  `px-3 py-1 text-sm ${on ? 'bg-(--color-ink) text-(--color-cream)' : 'text-(--color-muted)'}`

/**
 * The layout designer (#412): global templates at `/admin/layouts`, a game's own layouts at
 * `/admin/layouts/:gameId`. Pick or create a layout, place widgets from the palette on the
 * canvas, drag and resize them, edit the selected one in the inspector, and switch device
 * or to a live preview with sample data. Every change is saved as it is made.
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

  function chooseLayout(id: string) {
    setChosenId(id)
    setSelectedWidgetId(null)
  }

  function place(widget: Widget, rect: GridRect) {
    void updateWidget(
      widget.id,
      breakpoint ? { breakpoints: { ...widget.breakpoints, [breakpoint]: rect } } : { grid: rect }
    )
  }

  async function add(type: WidgetType, cell?: { x: number; y: number }) {
    if (!layout) return
    const { preferredSize, defaultConfig } = WIDGET_REGISTRY[type]
    const grid = cell
      ? clampRect({ ...cell, ...preferredSize })
      : nextFreeRect(rectsOn(widgets, breakpoint), preferredSize)
    const widget = await addWidget({ layoutId: layout.id, type, grid, config: defaultConfig })
    setSelectedWidgetId(widget.id)
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
              className="rounded border border-(--color-border) bg-(--color-cream) px-2 py-1 text-sm text-(--color-ink)"
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
                          ? 'bg-(--color-gold-light) font-semibold text-(--color-ink)'
                          : 'text-(--color-ink) hover:bg-black/5'
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
              <NewLayoutForm
                onCreate={async input =>
                  chooseLayout((await createLayout({ gameId, ...input })).id)
                }
              />
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
                  void updateWidget(selected.id, { breakpoints: rest })
                }}
                onConfig={config => void updateWidget(selected.id, { config })}
                onMove={dir => void reorderWidgets(swapOrder(widgets, selected.id, dir))}
                onDelete={() => {
                  setSelectedWidgetId(null)
                  void deleteWidget(selected.id)
                }}
              />
            ) : (
              layout && (
                <LayoutSettings
                  key={layout.id}
                  layout={layout}
                  onChange={patch => void updateLayout(layout.id, patch)}
                  onDelete={() =>
                    confirmDestructive ? setConfirmingDelete(true) : void removeLayout()
                  }
                />
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
          <p className="text-sm text-(--color-ink)">
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
