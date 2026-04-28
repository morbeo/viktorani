import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { DifficultyLevel } from '@/db'
import { Button, Input } from '@/components/ui'

interface EditState {
  id: string | null
  name: string
  color: string
  score: number
}

const DEFAULT_COLOR = '#6366f1'

function empty(): EditState {
  return { id: null, name: '', color: DEFAULT_COLOR, score: 10 }
}

export default function ManageDifficulties() {
  const difficulties = useLiveQuery(() => db.difficulties.orderBy('order').toArray(), [])
  const [editing, setEditing] = useState<EditState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // drag state — indices only, no extra lib
  const dragIdx = useRef<number | null>(null)

  function startAdd() {
    setEditing(empty())
    setError(null)
  }

  function startEdit(d: DifficultyLevel) {
    setEditing({ id: d.id, name: d.name, color: d.color, score: d.score })
    setError(null)
  }

  function cancel() {
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!editing) return
    const name = editing.name.trim()
    const score = Number(editing.score)
    if (!name) {
      setError('Name is required')
      return
    }
    if (isNaN(score) || score < 0) {
      setError('Score must be a non-negative number')
      return
    }

    setBusy(true)
    try {
      if (editing.id) {
        await db.difficulties.update(editing.id, { name, color: editing.color, score })
      } else {
        const count = await db.difficulties.count()
        await db.difficulties.add({
          id: crypto.randomUUID(),
          name,
          color: editing.color,
          score,
          order: count,
        })
      }
      setEditing(null)
    } catch {
      setError('Failed to save')
    } finally {
      setBusy(false)
    }
  }

  async function remove(d: DifficultyLevel) {
    const count = await db.questions.where('difficulty').equals(d.id).count()
    if (count > 0) {
      setError(
        `"${d.name}" is used by ${count} question${count === 1 ? '' : 's'} and cannot be deleted`
      )
      return
    }
    await db.difficulties.delete(d.id)
    // Re-normalise order
    const rest = await db.difficulties.orderBy('order').toArray()
    await db.difficulties.bulkPut(rest.map((item, i) => ({ ...item, order: i })))
    if (editing?.id === d.id) setEditing(null)
  }

  // ── drag-to-reorder ──────────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, idx: number) {
    dragIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function onDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault()
    const fromIdx = dragIdx.current
    if (fromIdx === null || fromIdx === toIdx || !difficulties) return
    dragIdx.current = null

    const reordered = [...difficulties]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    await db.difficulties.bulkPut(reordered.map((item, i) => ({ ...item, order: i })))
  }

  const isEditing = (id: string) => editing?.id === id

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
            Difficulty levels
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Score value and colour — drag to reorder
          </p>
        </div>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={startAdd}>
            + Add
          </Button>
        )}
      </div>

      {error && (
        <p
          className="text-xs mb-3 px-3 py-2 rounded"
          style={{ color: 'var(--color-red)', background: 'var(--color-red)1a' }}
        >
          {error}
        </p>
      )}

      <div
        className="rounded-lg overflow-hidden border"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {/* Add row */}
        {editing?.id === null && (
          <div
            className="flex items-center gap-2 px-3 py-2 border-b"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <input
              type="color"
              value={editing.color}
              onChange={e => setEditing(s => s && { ...s, color: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border"
              style={{ borderColor: 'var(--color-border)', padding: '1px' }}
              aria-label="Difficulty colour"
            />
            <Input
              value={editing.name}
              onChange={e => setEditing(s => s && { ...s, name: e.target.value })}
              placeholder="Name"
              className="flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') cancel()
              }}
              autoFocus
            />
            <Input
              type="number"
              value={String(editing.score)}
              onChange={e => setEditing(s => s && { ...s, score: Number(e.target.value) })}
              placeholder="pts"
              className="w-20 text-center"
              min={0}
            />
            <Button variant="primary" size="sm" onClick={save} disabled={busy}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          </div>
        )}

        {difficulties?.length === 0 && !editing && (
          <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-muted)' }}>
            No difficulty levels yet — add one above
          </p>
        )}

        {difficulties?.map((d, i) => (
          <div
            key={d.id}
            className="border-b last:border-b-0"
            style={{ borderColor: 'var(--color-border)' }}
            draggable={!editing}
            onDragStart={e => onDragStart(e, i)}
            onDragOver={e => onDragOver(e)}
            onDrop={e => onDrop(e, i)}
          >
            {isEditing(d.id) ? (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: 'var(--color-surface)' }}
              >
                <input
                  type="color"
                  value={editing!.color}
                  onChange={e => setEditing(s => s && { ...s, color: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border"
                  style={{ borderColor: 'var(--color-border)', padding: '1px' }}
                  aria-label="Difficulty colour"
                />
                <Input
                  value={editing!.name}
                  onChange={e => setEditing(s => s && { ...s, name: e.target.value })}
                  className="flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter') save()
                    if (e.key === 'Escape') cancel()
                  }}
                  autoFocus
                />
                <Input
                  type="number"
                  value={String(editing!.score)}
                  onChange={e => setEditing(s => s && { ...s, score: Number(e.target.value) })}
                  className="w-20 text-center"
                  min={0}
                />
                <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={cancel}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Drag handle — only shown when not editing anything */}
                {!editing && (
                  <span
                    className="text-xs cursor-grab select-none"
                    style={{ color: 'var(--color-muted)', letterSpacing: '0.5px' }}
                    aria-hidden
                  >
                    ⠿
                  </span>
                )}
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: d.color }}
                  aria-hidden
                />
                <span className="flex-1 text-sm" style={{ color: 'var(--color-ink)' }}>
                  {d.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {d.score} pts
                </span>
                <button
                  onClick={() => startEdit(d)}
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
                  style={{ color: 'var(--color-muted)' }}
                  aria-label={`Edit ${d.name}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(d)}
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
                  style={{ color: 'var(--color-red)' }}
                  aria-label={`Delete ${d.name}`}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
