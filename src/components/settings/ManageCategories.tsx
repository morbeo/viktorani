import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Category } from '@/db'
import { Button, Input } from '@/components/ui'

interface EditState {
  id: string | null // null = new
  name: string
  color: string
}

const DEFAULT_COLOR = '#6366f1'

function empty(): EditState {
  return { id: null, name: '', color: DEFAULT_COLOR }
}

export default function ManageCategories() {
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])
  const [editing, setEditing] = useState<EditState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setError(null)
  }, [editing])

  function startAdd() {
    setEditing(empty())
  }

  function startEdit(cat: Category) {
    setEditing({ id: cat.id, name: cat.name, color: cat.color })
  }

  function cancel() {
    setEditing(null)
    setError(null)
  }

  async function save() {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) {
      setError('Name is required')
      return
    }

    setBusy(true)
    try {
      if (editing.id) {
        await db.categories.update(editing.id, { name, color: editing.color })
      } else {
        await db.categories.add({ id: crypto.randomUUID(), name, color: editing.color })
      }
      setEditing(null)
    } catch {
      setError('Failed to save — name may already be in use')
    } finally {
      setBusy(false)
    }
  }

  async function remove(cat: Category) {
    const count = await db.questions.where('categoryId').equals(cat.id).count()
    if (count > 0) {
      setError(
        `"${cat.name}" is used by ${count} question${count === 1 ? '' : 's'} and cannot be deleted`
      )
      return
    }
    await db.categories.delete(cat.id)
    if (editing?.id === cat.id) setEditing(null)
  }

  const isEditing = (id: string) => editing?.id === id

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-base" style={{ color: 'var(--color-ink)' }}>
            Categories
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Question classifiers used for filtering and search
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
              aria-label="Category colour"
            />
            <Input
              value={editing.name}
              onChange={e => setEditing(s => s && { ...s, name: e.target.value })}
              placeholder="Category name"
              className="flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') cancel()
              }}
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={save} disabled={busy}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          </div>
        )}

        {/* List */}
        {categories?.length === 0 && !editing && (
          <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-muted)' }}>
            No categories yet — add one above
          </p>
        )}

        {categories?.map(cat => (
          <div
            key={cat.id}
            className={`border-b last:border-b-0 ${isEditing(cat.id) ? '' : ''}`}
            style={{ borderColor: 'var(--color-border)' }}
          >
            {isEditing(cat.id) ? (
              /* Inline edit row */
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
                  aria-label="Category colour"
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
                <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={cancel}>
                  Cancel
                </Button>
              </div>
            ) : (
              /* Display row */
              <div className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: cat.color }}
                  aria-hidden
                />
                <span className="flex-1 text-sm" style={{ color: 'var(--color-ink)' }}>
                  {cat.name}
                </span>
                <button
                  onClick={() => startEdit(cat)}
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
                  style={{ color: 'var(--color-muted)' }}
                  aria-label={`Edit ${cat.name}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(cat)}
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-black/5"
                  style={{ color: 'var(--color-red)' }}
                  aria-label={`Delete ${cat.name}`}
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
