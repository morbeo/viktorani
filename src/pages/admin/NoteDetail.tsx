import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkDefinitionList, defListHastHandlers } from 'remark-definition-list'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
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
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-bg text-text">
        <p
          className="text-6xl font-black text-muted"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          404
        </p>
        <p className="text-sm text-muted">Note not found.</p>
        <Link to="/admin/notes" className="text-sm underline text-accent">
          Back to notes
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link to="/admin/notes" className="text-xs mb-6 inline-block text-muted">
            ← Notes
          </Link>
          <h1 className="text-3xl font-bold mt-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            {note.name}
          </h1>
          <p className="text-xs mt-1 text-muted">Updated {formatDate(note.updatedAt)}</p>
        </div>

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
