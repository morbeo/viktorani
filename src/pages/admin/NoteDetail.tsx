import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { db } from '@/db'
import type { Note } from '@/db'

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>()
  const [note, setNote] = useState<Note | null | undefined>(undefined) // undefined = loading

  useEffect(() => {
    if (!id) return
    db.notes.get(id).then(n => setNote(n ?? null))
  }, [id])

  if (note === undefined) return null // still loading — no flash

  if (note === null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-4"
        style={{ background: 'var(--color-cream)', color: 'var(--color-ink)' }}
      >
        <p
          className="text-6xl font-black"
          style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-muted)' }}
        >
          404
        </p>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Note not found.
        </p>
        <Link
          to="/admin/notes"
          className="text-sm underline"
          style={{ color: 'var(--color-gold)' }}
        >
          Back to notes
        </Link>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--color-cream)', color: 'var(--color-ink)' }}
    >
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link
            to="/admin/notes"
            className="text-xs mb-6 inline-block"
            style={{ color: 'var(--color-muted)' }}
          >
            ← Notes
          </Link>
          <h1
            className="text-3xl font-bold mt-2"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {note.name}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
            Updated {formatDate(note.updatedAt)}
          </p>
        </div>

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
