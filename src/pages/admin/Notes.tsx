import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkDefinitionList, defListHastHandlers } from 'remark-definition-list'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import AdminLayout from '@/components/AdminLayout'
import { Button, Input, Textarea, Modal, Empty } from '@/components/ui'
import { db } from '@/db'
import type { Note } from '@/db'
import { exportNote, importNoteFile } from '@/db/snapshot'

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
            <span className="text-xs font-medium text-muted">Content (markdown)</span>
            <button
              className="text-xs px-2 py-0.5 rounded border transition-all border-border"
              style={{
                color: preview ? 'var(--color-accent)' : 'var(--color-muted)',
                background: preview ? 'var(--color-accent-subtle)' : 'transparent',
              }}
              onClick={() => setPreview(p => !p)}
            >
              {preview ? '✎ Edit' : '◉ Preview'}
            </button>
          </div>

          {preview ? (
            <div
              className="rounded border px-4 py-3 overflow-y-auto border-border bg-bg"
              style={{
                minHeight: 200,
                maxHeight: 320,
              }}
            >
              <div className="note-prose">
                {content.trim() ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkDefinitionList]}
                    remarkRehypeOptions={{ handlers: defListHastHandlers }}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  >
                    {content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-muted">Nothing to preview.</p>
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

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
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
        <p className="text-sm text-text">
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
  onExport,
}: {
  note: Note
  onEdit: () => void
  onDelete: () => void
  onExport: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b flex items-center justify-between shrink-0 border-border">
        <div>
          <h2
            className="text-2xl font-bold text-text"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {note.name}
          </h2>
          <p className="text-xs mt-0.5 text-muted">Updated {formatDate(note.updatedAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onExport}>
            Export .md
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-negative">
            Delete
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {note.content.trim() ? (
          <div className="note-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkDefinitionList]}
              remarkRehypeOptions={{ handlers: defListHastHandlers }}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
            >
              {note.content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted" style={{ fontStyle: 'italic' }}>
            This note is empty.
          </p>
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
  const importInputRef = useRef<HTMLInputElement>(null)

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

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const { name, content } = await importNoteFile(file)
    const ts = Date.now()
    const id = crypto.randomUUID()
    await db.notes.add({ id, name, content, createdAt: ts, updatedAt: ts })
    setSelected(id)
    await load()
  }

  return (
    <AdminLayout>
      <div className="flex h-full -mx-8 -my-6" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r flex flex-col border-border">
          <div className="px-4 py-3 border-b flex items-center justify-between border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
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

          <div className="px-3 py-2 border-b border-border">
            <input
              className="w-full px-2.5 py-1.5 rounded border text-sm outline-none border-border bg-bg text-text"
              placeholder="Search notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted">{search ? 'No notes match.' : 'No notes yet.'}</p>
              </div>
            ) : (
              filtered.map(note => (
                <div
                  key={note.id}
                  className="relative border-b group border-border"
                  style={{
                    background: selected === note.id ? 'var(--color-accent-subtle)' : 'transparent',
                  }}
                >
                  <button
                    onClick={() => setSelected(note.id)}
                    className="w-full text-left px-4 py-3 pr-8 transition-all"
                  >
                    <p
                      className="text-sm truncate"
                      style={{ fontWeight: selected === note.id ? 600 : 400 }}
                    >
                      {note.name}
                    </p>
                    <p className="text-xs mt-0.5 truncate text-muted">
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
                  <Link
                    to={`/admin/notes/${note.id}`}
                    title="Open note page"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-xs leading-none text-muted"
                  >
                    ↗
                  </Link>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t flex gap-2 border-border">
            <Button variant="primary" size="sm" onClick={() => setEditing({})}>
              + New note
            </Button>
            <Button variant="secondary" size="sm" onClick={() => importInputRef.current?.click()}>
              Import .md
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".md,text/markdown"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </aside>

        {/* Viewer pane */}
        <div className="flex-1 overflow-hidden">
          {activeNote ? (
            <NoteViewer
              note={activeNote}
              onEdit={() => setEditing(activeNote)}
              onDelete={() => setDeleting(activeNote)}
              onExport={() => exportNote(activeNote)}
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
