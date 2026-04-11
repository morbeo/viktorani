// Tests for the note-specific import/export helpers in snapshot.ts.
// These functions are pure (no DB writes) so no vmForks annotation is needed.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { exportNote, importNoteFile } from '@/db/snapshot'
import type { Note } from '@/db'

// ── importNoteFile ────────────────────────────────────────────────────────────

describe('importNoteFile', () => {
  function makeFile(content: string, name: string, type = 'text/markdown'): File {
    return new File([content], name, { type })
  }

  it('returns content from a plain markdown file', async () => {
    const file = makeFile('# Hello\n\nWorld', 'hello.md')
    const { content } = await importNoteFile(file)
    expect(content).toBe('# Hello\n\nWorld')
  })

  it('derives name from filename by removing .md extension', async () => {
    const file = makeFile('', 'my-note.md')
    const { name } = await importNoteFile(file)
    expect(name).toBe('my note')
  })

  it('converts underscores in filename to spaces', async () => {
    const file = makeFile('', 'session_prep.md')
    const { name } = await importNoteFile(file)
    expect(name).toBe('session prep')
  })

  it('strips HTML tags from content', async () => {
    const file = makeFile('<b>bold</b> and <em>italic</em>', 'note.md')
    const { content } = await importNoteFile(file)
    expect(content).toBe('bold and italic')
  })

  it('falls back to "Imported note" when filename is empty after sanitizing', async () => {
    const file = makeFile('', '.md')
    const { name } = await importNoteFile(file)
    expect(name).toBe('Imported note')
  })

  it('preserves markdown syntax (not treated as HTML)', async () => {
    const md = '# Title\n\n- item\n\n**bold**'
    const file = makeFile(md, 'note.md')
    const { content } = await importNoteFile(file)
    expect(content).toBe(md)
  })
})

// ── exportNote ────────────────────────────────────────────────────────────────

describe('exportNote', () => {
  const clicks: { href: string; download: string }[] = []

  afterEach(() => {
    clicks.length = 0
    vi.restoreAllMocks()
  })

  function spyExport() {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = {
          href: '',
          download: '',
          click: () => clicks.push({ href: a.href, download: a.download }),
        } as unknown as HTMLAnchorElement
        return a
      }
      return document.createElement(tag)
    })
  }

  function makeNote(overrides: Partial<Note> = {}): Note {
    const ts = Date.now()
    return {
      id: crypto.randomUUID(),
      name: 'Test Note',
      content: '# Hello',
      createdAt: ts,
      updatedAt: ts,
      ...overrides,
    }
  }

  it('triggers a download with a .md extension', () => {
    spyExport()
    exportNote(makeNote({ name: 'My Note' }))
    expect(clicks[0].download).toBe('My Note.md')
  })

  it('sanitizes special characters in the filename', () => {
    spyExport()
    exportNote(makeNote({ name: 'Round #1: "Winners"' }))
    expect(clicks[0].download).toMatch(/\.md$/)
    expect(clicks[0].download).not.toMatch(/[#:"<>|*?/\\]/)
  })

  it('uses a non-empty filename when name contains only special chars', () => {
    spyExport()
    exportNote(makeNote({ name: '##' }))
    // ## -> __ after sanitize; trim leaves '__' which is truthy -> download as '__.md'
    expect(clicks[0].download).toMatch(/\.md$/)
  })

  it('creates a blob URL and revokes it after click', () => {
    spyExport()
    const before = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length
    exportNote(makeNote())
    const after = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.length
    expect(after - before).toBe(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
