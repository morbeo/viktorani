import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { ManagedTeam } from '@/types/players-teams'
import { Modal, Button, Input, Icon } from '@/components/ui'
import { TEAM_ICONS, resolveIcon } from './teamIcons'
import { whiteTextPassesAA, contrastRatio } from './contrast'

interface Props {
  team: ManagedTeam | null // null = new
  open: boolean
  onClose: () => void
}

interface FormState {
  name: string
  color: string
  icon: string
  labelIds: string[]
}

const DEFAULT_COLOR = '#3a57b7'
const DEFAULT_ICON = 'Shield'

const PRESET_COLORS = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#3a57b7',
  '#8e44ad',
  '#1abc9c',
  '#95a5a6',
]

function emptyForm(): FormState {
  return { name: '', color: DEFAULT_COLOR, icon: DEFAULT_ICON, labelIds: [] }
}

function teamToForm(t: ManagedTeam): FormState {
  return { name: t.name, color: t.color, icon: t.icon, labelIds: t.labelIds }
}

export default function TeamForm({ team, open, onClose }: Props) {
  const isNew = team === null
  const labels = useLiveQuery(() => db.managedLabels.orderBy('name').toArray(), [])

  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dismissedContrast, setDismissedContrast] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(team ? teamToForm(team) : emptyForm())
    setError(null)
    setDismissedContrast(false)
  }, [open, team])

  const contrastOk = whiteTextPassesAA(form.color)
  const ratio = contrastRatio('#ffffff', form.color)
  const showContrastWarn = !contrastOk && !dismissedContrast

  function toggleLabel(id: string) {
    setForm(f => ({
      ...f,
      labelIds: f.labelIds.includes(id) ? f.labelIds.filter(l => l !== id) : [...f.labelIds, id],
    }))
  }

  async function save() {
    const name = form.name.trim()
    if (!name) {
      setError('Name is required')
      return
    }

    setBusy(true)
    try {
      if (team) {
        await db.managedTeams.update(team.id, {
          name,
          color: form.color,
          icon: form.icon,
          labelIds: form.labelIds,
        })
      } else {
        await db.managedTeams.add({
          id: crypto.randomUUID(),
          name,
          color: form.color,
          icon: form.icon,
          labelIds: form.labelIds,
          playerIds: [],
          archivedAt: null,
          totalScore: 0,
          gameLog: [],
        })
      }
      onClose()
    } catch {
      setError('Failed to save — please try again')
    } finally {
      setBusy(false)
    }
  }

  const SelectedIcon = resolveIcon(form.icon)

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'New team' : 'Edit team'} maxWidth="480px">
      <div className="flex flex-col gap-5">
        {error && (
          <p
            className="text-xs px-3 py-2 rounded"
            style={{ color: 'var(--color-red)', background: 'var(--color-red)1a' }}
          >
            {error}
          </p>
        )}

        {/* Name */}
        <Input
          label="Name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Team name"
          onKeyDown={e => {
            if (e.key === 'Enter') save()
          }}
          autoFocus
        />

        {/* Color + live badge preview */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Colour
          </span>

          {/* Preset swatches */}
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className="w-6 h-6 rounded transition-all"
                style={{
                  background: c,
                  outline: form.color === c ? `2px solid var(--color-ink)` : 'none',
                  outlineOffset: 2,
                }}
                aria-label={`Set colour ${c}`}
                aria-pressed={form.color === c}
              />
            ))}
            {/* Custom hex input */}
            <input
              type="color"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="w-6 h-6 rounded cursor-pointer border"
              style={{ borderColor: 'var(--color-border)', padding: '1px' }}
              aria-label="Custom colour"
            />
          </div>

          {/* Live badge preview */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: form.color, color: '#ffffff' }}
            aria-label="Team badge preview"
          >
            <Icon icon={SelectedIcon} size="sm" />
            <span>{form.name || 'Team name'}</span>
          </div>

          {/* Contrast warning */}
          {showContrastWarn && (
            <div
              className="flex items-center justify-between gap-3 px-3 py-2 rounded text-xs"
              style={{
                background: 'color-mix(in srgb, #b7700a 10%, transparent)',
                color: '#7a4d08',
              }}
            >
              <span>White text contrast {ratio?.toFixed(1)}:1 — below WCAG AA (4.5:1)</span>
              <button
                type="button"
                onClick={() => setDismissedContrast(true)}
                className="shrink-0 underline"
                aria-label="Dismiss contrast warning"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Icon picker */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            Icon
          </span>
          <div
            className="grid gap-1 overflow-y-auto rounded border p-2"
            style={{
              gridTemplateColumns: 'repeat(10, 1fr)',
              maxHeight: 160,
              borderColor: 'var(--color-border)',
              background: 'var(--color-cream)',
            }}
          >
            {TEAM_ICONS.map(({ key, icon }) => {
              const selected = form.icon === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, icon: key }))}
                  className="flex items-center justify-center rounded transition-all"
                  style={{
                    width: 28,
                    height: 28,
                    background: selected ? form.color + '22' : 'transparent',
                    border: selected ? `1px solid ${form.color}` : '1px solid transparent',
                  }}
                  aria-label={`Select icon ${key}`}
                  aria-pressed={selected}
                >
                  <Icon icon={icon} size="sm" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Label assignment */}
        {labels && labels.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Labels
            </span>
            <div className="flex flex-wrap gap-2">
              {labels.map(label => {
                const selected = form.labelIds.includes(label.id)
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all"
                    style={{
                      borderColor: selected ? label.color : 'var(--color-border)',
                      background: selected ? label.color + '22' : 'transparent',
                      color: selected ? label.color : 'var(--color-muted)',
                    }}
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Remove' : 'Add'} label ${label.name}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: label.color }}
                      aria-hidden
                    />
                    {label.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving...' : isNew ? 'Create team' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
