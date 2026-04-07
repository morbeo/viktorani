import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AdminLayout from '@/components/AdminLayout'
import { Button, Input, Textarea, Modal, Empty } from '@/components/ui'
import { db } from '@/db'
import type { Note } from '@/db'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ── Note Form Modal ───────────────────────────────────────────────────────────

interface NoteFormProps {
  note: Partial<Note> | null
  onSave: (data: { id?: string; name: string; content: string }) => void
  onClose: () => void
}

function NoteForm({ note, onSave, onClose }: NoteFormProps) {
  const isNew = !note?.id
  const [name, setName] = useState(note?.name ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [preview, setPreview] = useState(false)

  function handleSubmit() {
    if (!name.trim()) return
    onSave({ ...(note?.id ? { id: note.id } : {}), name: name.trim(), content })
  }

  return (
    <Modal open title={isNew ? 'New note' : 'Edit note'} onClose={onClose} maxWidth="680px">
      <div className="flex flex-col gap-4">
        <Input
          label="Title *"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Note title…"
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Content (markdown)
            </span>
            <button
              className="text-xs px-2 py-0.5 rounded border transition-all"
              style={{
                borderColor: 'var(--color-border)',
                color: preview ? 'var(--color-gold)' : 'var(--color-muted)',
                background: preview ? 'var(--color-gold-light)' : 'transparent',
              }}
              onClick={() => setPreview(p => !p)}
            >
              {preview ? '✎ Edit' : '◉ Preview'}
            </button>
          </div>

          {preview ? (
            <div
              className="rounded border px-4 py-3 overflow-y-auto"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-cream)',
                minHeight: 200,
                maxHeight: 320,
              }}
            >
              <div className="note-prose">
                {content.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                ) : (
                  <p style={{ color: 'var(--color-muted)' }}>Nothing to preview.</p>
                )}
              </div>
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write in markdown…"
              style={{
                minHeight: 200,
                maxHeight: 320,
                fontFamily: 'DM Mono, monospace',
                fontSize: 13,
              }}
            />
          )}
        </div>

        <div
          className="flex justify-end gap-2 pt-2 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>
            {isNew ? 'Create note' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({
  note,
  onConfirm,
  onClose,
}: {
  note: Note
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal open title="Delete note" onClose={onClose} maxWidth="400px">
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
          Delete <strong>{note.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Note viewer ───────────────────────────────────────────────────────────────

function NoteViewer({
  note,
  onEdit,
  onDelete,
}: {
  note: Note
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div
        className="px-8 py-5 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-ink)' }}
          >
            {note.name}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Updated {formatDate(note.updatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            style={{ color: 'var(--color-red)' }}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {note.content.trim() ? (
          <div className="note-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          </div>
        ) : (
          <p style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>This note is empty.</p>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Note> | null | false>(false)
  const [deleting, setDeleting] = useState<Note | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    const all = await db.notes.orderBy('updatedAt').reverse().toArray()
    setNotes(all)
  }

  useEffect(() => {
    db.notes.orderBy('updatedAt').reverse().toArray().then(setNotes)
  }, [])

  const filtered = search.trim()
    ? notes.filter(
        n =>
          n.name.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes

  // Derive active note — fall back to first in list when selection is stale or null
  const activeNote = notes.find(n => n.id === selected) ?? notes[0] ?? null

  async function handleSave(data: { id?: string; name: string; content: string }) {
    const ts = Date.now()
    if (data.id) {
      await db.notes.update(data.id, { name: data.name, content: data.content, updatedAt: ts })
    } else {
      const id = crypto.randomUUID()
      await db.notes.add({
        id,
        name: data.name,
        content: data.content,
        createdAt: ts,
        updatedAt: ts,
      })
      setSelected(id)
    }
    setEditing(false)
    await load()
  }

  async function handleDelete(note: Note) {
    await db.notes.delete(note.id)
    setDeleting(null)
    await load()
  }

  return (
    <AdminLayout>
      <div className="flex h-full -mx-8 -my-6" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Sidebar */}
        <aside
          className="w-64 shrink-0 border-r flex flex-col"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-muted)' }}
            >
              Notes {notes.length > 0 && `· ${notes.length}`}
            </span>
            <button
              onClick={() => setEditing({})}
              className="text-xl leading-none hover:opacity-60 transition-opacity"
              title="New note"
            >
              +
            </button>
          </div>

          <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <input
              className="w-full px-2.5 py-1.5 rounded border text-sm outline-none"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-cream)',
                color: 'var(--color-ink)',
              }}
              placeholder="Search notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  {search ? 'No notes match.' : 'No notes yet.'}
                </p>
              </div>
            ) : (
              filtered.map(note => (
                <button
                  key={note.id}
                  onClick={() => setSelected(note.id)}
                  className="w-full text-left px-4 py-3 border-b transition-all"
                  style={{
                    borderColor: 'var(--color-border)',
                    background: selected === note.id ? 'var(--color-gold-light)' : 'transparent',
                  }}
                >
                  <p
                    className="text-sm truncate"
                    style={{ fontWeight: selected === note.id ? 600 : 400 }}
                  >
                    {note.name}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>
                    {formatDate(note.updatedAt)}
                    {note.content.trim()
                      ? ' · ' +
                        note.content
                          .trim()
                          .slice(0, 40)
                          .replace(/[#*`_]/g, '')
                      : ''}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <Button variant="primary" size="sm" onClick={() => setEditing({})}>
              + New note
            </Button>
          </div>
        </aside>

        {/* Viewer pane */}
        <div className="flex-1 overflow-hidden">
          {activeNote ? (
            <NoteViewer
              note={activeNote}
              onEdit={() => setEditing(activeNote)}
              onDelete={() => setDeleting(activeNote)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Empty icon="✎" message="Select a note or create a new one." />
            </div>
          )}
        </div>
      </div>

      {editing !== false && (
        <NoteForm note={editing} onSave={handleSave} onClose={() => setEditing(false)} />
      )}

      {deleting && (
        <DeleteModal
          note={deleting}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </AdminLayout>
  )
}
