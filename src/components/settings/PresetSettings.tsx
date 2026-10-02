import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button, Icon, Input, Modal } from '@/components/ui'
import { GameSettingsForm } from '@/components/game-settings/GameSettingsForm'
import { BUILT_IN_PRESETS, pickGameSettings } from '@/components/game-settings/game-settings'
import type { GamePreset } from '@/components/game-settings/game-settings'
import { useAppSettings } from '@/hooks/useAppSettings'
import { MAX_PRESETS } from '@/lib/app-settings'

/**
 * The presets offered in the game settings form: add, edit, reorder and delete them, and
 * restore the built-in ones.
 */
export default function PresetSettings() {
  const [settings, update] = useAppSettings()
  const presets = settings.gamePresets
  const [editing, setEditing] = useState<GamePreset | null>(null)
  const [deleting, setDeleting] = useState<GamePreset | null>(null)

  const save = (next: GamePreset[]) => update({ gamePresets: next })
  const isNew = editing !== null && !presets.some(p => p.id === editing.id)

  function move(index: number, by: -1 | 1) {
    const next = [...presets]
    const [moved] = next.splice(index, 1)
    next.splice(index + by, 0, moved)
    save(next)
  }

  function remove(preset: GamePreset) {
    save(presets.filter(p => p.id !== preset.id))
    setDeleting(null)
  }

  function saveEditing() {
    if (!editing?.label.trim()) return
    const label = editing.label.trim()
    const preset = { ...editing, label, description: editing.description.trim() }
    save(isNew ? [...presets, preset] : presets.map(p => (p.id === preset.id ? preset : p)))
    setEditing(null)
  }

  // Put back any built-in preset that was changed or deleted; custom presets stay
  function resetBuiltIns() {
    const builtIns = JSON.parse(JSON.stringify(BUILT_IN_PRESETS)) as GamePreset[]
    const custom = presets.filter(p => !builtIns.some(b => b.id === p.id))
    save([...builtIns, ...custom].slice(0, MAX_PRESETS))
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
            Presets
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Offered in the game settings of the new-game wizard and the game master. During a
            game a preset only changes joining and the buzzer.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={resetBuiltIns}>
            <Icon icon={RotateCcw} size="sm" />
            Reset built-ins
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={presets.length >= MAX_PRESETS}
            onClick={() =>
              setEditing({
                id: crypto.randomUUID(),
                label: '',
                description: '',
                settings: pickGameSettings(settings.gameDefaults),
              })
            }
          >
            <Icon icon={Plus} size="sm" />
            Add preset
          </Button>
        </div>
      </div>

      {presets.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          No presets. Add one, or reset the built-ins.
        </p>
      ) : (
        <ul
          className="flex flex-col rounded-lg border divide-y"
          style={{ borderColor: 'var(--color-border)' }}
          aria-label="Presets"
        >
          {presets.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 px-3 py-2"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.label}</p>
                {p.description && (
                  <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                    {p.description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Move ${p.label} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <Icon icon={ArrowUp} size="sm" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Move ${p.label} down`}
                disabled={i === presets.length - 1}
                onClick={() => move(i, 1)}
              >
                <Icon icon={ArrowDown} size="sm" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Edit ${p.label}`}
                onClick={() => setEditing(p)}
              >
                <Icon icon={Pencil} size="sm" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete ${p.label}`}
                onClick={() => (settings.confirmDestructive ? setDeleting(p) : remove(p))}
              >
                <Icon icon={Trash2} size="sm" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        title={isNew ? 'New preset' : 'Edit preset'}
        onClose={() => setEditing(null)}
        maxWidth="560px"
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <Input
              id="preset-label"
              label="Name"
              value={editing.label}
              maxLength={60}
              autoFocus
              onChange={e => setEditing({ ...editing, label: e.target.value })}
            />
            <Input
              id="preset-description"
              label="Description"
              value={editing.description}
              maxLength={300}
              onChange={e => setEditing({ ...editing, description: e.target.value })}
            />
            <GameSettingsForm
              value={editing.settings}
              onChange={patch =>
                setEditing({ ...editing, settings: { ...editing.settings, ...patch } })
              }
              mode="create"
              presets={false}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={saveEditing} disabled={!editing.label.trim()}>
                Save preset
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={deleting !== null} title="Delete preset" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Delete the preset <strong>{deleting.label}</strong>? Games that used it keep their
              settings.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => remove(deleting)}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
