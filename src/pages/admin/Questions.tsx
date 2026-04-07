import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'
import AdminLayout from '@/components/AdminLayout'
import { Button, Badge, Input, Select, Modal, Textarea, Empty } from '@/components/ui'
import { db } from '@/db'
import { exportQuestions, importQuestions, downloadExampleQuestions } from '@/db/snapshot'
import type { ImportResult } from '@/db/snapshot'
import type { Question, QuestionType, Category, DifficultyLevel, Tag, Round } from '@/db'

// ── Helpers ───────────────────────────────────────────────────────────────────

function newQuestion(): Omit<Question, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    type: 'multiple_choice',
    options: ['', '', '', ''],
    answer: '',
    description: '',
    categoryId: null,
    difficulty: null,
    tags: [],
    media: null,
    mediaType: null,
  }
}

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  open_ended: 'Open ended',
}

// ── Question Form Modal ───────────────────────────────────────────────────────

interface FormProps {
  question: Partial<Question> | null
  categories: Category[]
  difficulties: DifficultyLevel[]
  tags: Tag[]
  onSave: (q: Omit<Question, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void
  onClose: () => void
}

function QuestionForm({ question, categories, difficulties, tags, onSave, onClose }: FormProps) {
  const isNew = !question?.id
  const [form, setForm] = useState(() => ({
    ...newQuestion(),
    ...question,
  }))

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function setOption(i: number, val: string) {
    const opts = [...form.options]
    opts[i] = val
    set('options', opts)
  }

  function handleTypeChange(type: QuestionType) {
    set('type', type)
    if (type === 'true_false') set('options', ['True', 'False'])
    else if (type === 'multiple_choice') set('options', ['', '', '', ''])
    else set('options', [])
    set('answer', '')
  }

  function toggleTag(id: string) {
    set('tags', form.tags.includes(id) ? form.tags.filter(t => t !== id) : [...form.tags, id])
  }

  function handleSubmit() {
    if (!form.title.trim()) return
    onSave({ ...form, ...(question?.id ? { id: question.id } : {}) })
  }

  const typeOpts = Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
  const catOpts = [
    { value: '', label: 'No category' },
    ...categories.map(c => ({ value: c.id, label: c.name })),
  ]
  const diffOpts = [
    { value: '', label: 'No difficulty' },
    ...difficulties.map(d => ({ value: d.id, label: d.name })),
  ]

  return (
    <Modal open title={isNew ? 'New question' : 'Edit question'} onClose={onClose} maxWidth="600px">
      <div className="flex flex-col gap-4">
        <Input
          label="Question title *"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Enter the question…"
        />

        <Select
          label="Type"
          value={form.type}
          options={typeOpts}
          onChange={e => handleTypeChange(e.target.value as QuestionType)}
        />

        {/* Options */}
        {form.type === 'multiple_choice' && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
              Answer options
            </span>
            {form.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="mono text-xs w-5 text-center"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  className="flex-1 px-3 py-2 rounded border text-sm outline-none"
                  style={{
                    borderColor:
                      form.answer === opt && opt ? 'var(--color-green)' : 'var(--color-border)',
                    background: 'var(--color-cream)',
                  }}
                  value={opt}
                  onChange={e => setOption(i, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                />
                <button
                  title="Mark as correct answer"
                  onClick={() => set('answer', opt)}
                  className="px-2 py-1 rounded text-xs border transition-all"
                  style={{
                    borderColor:
                      form.answer === opt && opt ? 'var(--color-green)' : 'var(--color-border)',
                    background: form.answer === opt && opt ? 'var(--color-green)' : 'transparent',
                    color: form.answer === opt && opt ? '#fff' : 'var(--color-muted)',
                  }}
                >
                  ✓
                </button>
              </div>
            ))}
          </div>
        )}

        {form.type === 'true_false' && (
          <div className="flex gap-3">
            {['True', 'False'].map(v => (
              <button
                key={v}
                onClick={() => set('answer', v)}
                className="flex-1 py-2 rounded border text-sm font-medium transition-all"
                style={{
                  borderColor: form.answer === v ? 'var(--color-green)' : 'var(--color-border)',
                  background: form.answer === v ? 'var(--color-green)' : 'transparent',
                  color: form.answer === v ? '#fff' : 'var(--color-ink)',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        {form.type === 'open_ended' && (
          <Input
            label="Expected answer"
            value={form.answer}
            onChange={e => set('answer', e.target.value)}
            placeholder="The correct answer…"
          />
        )}

        <Textarea
          label="Description (markdown)"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Optional notes, hints, context…"
          style={{ minHeight: 80 }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            value={form.categoryId ?? ''}
            options={catOpts}
            onChange={e => set('categoryId', e.target.value || null)}
          />
          <Select
            label="Difficulty"
            value={form.difficulty ?? ''}
            options={diffOpts}
            onChange={e => set('difficulty', e.target.value || null)}
          />
        </div>

        {tags.length > 0 && (
          <div>
            <span
              className="text-xs font-medium block mb-2"
              style={{ color: 'var(--color-muted)' }}
            >
              Tags
            </span>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className="px-2.5 py-1 rounded-full text-xs border transition-all"
                  style={{
                    borderColor: form.tags.includes(tag.id) ? tag.color : 'var(--color-border)',
                    background: form.tags.includes(tag.id) ? tag.color : 'transparent',
                    color: form.tags.includes(tag.id) ? '#fff' : 'var(--color-ink)',
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className="flex justify-end gap-2 pt-2 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!form.title.trim()}>
            {isNew ? 'Add question' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Round sidebar ─────────────────────────────────────────────────────────────

interface RoundSidebarProps {
  rounds: Round[]
  selected: string | null
  onSelect: (id: string | null) => void
  onNewRound: () => void
  onEditRound: (round: Round) => void
  onDeleteRound: (round: Round) => void
  selectedQIds: string[]
  onAddToRound: (roundId: string) => void
}

function RoundSidebar({
  rounds,
  selected,
  onSelect,
  onNewRound,
  onEditRound,
  onDeleteRound,
  selectedQIds,
  onAddToRound,
}: RoundSidebarProps) {
  return (
    <aside
      className="w-52 shrink-0 border-r flex flex-col"
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
          Rounds
        </span>
        <button
          onClick={onNewRound}
          className="text-lg leading-none hover:opacity-60 transition-opacity"
          title="New round"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <button
          onClick={() => onSelect(null)}
          className="w-full text-left px-4 py-2 text-sm transition-all"
          style={{
            background: selected === null ? 'var(--color-gold-light)' : 'transparent',
            color: selected === null ? 'var(--color-ink)' : 'var(--color-muted)',
            fontWeight: selected === null ? 600 : 400,
          }}
        >
          All questions
        </button>
        {rounds.map(r => (
          <div key={r.id} className="group flex items-center">
            <button
              onClick={() => onSelect(r.id)}
              className="flex-1 text-left px-4 py-2 text-sm transition-all"
              style={{
                background: selected === r.id ? 'var(--color-gold-light)' : 'transparent',
                color: selected === r.id ? 'var(--color-ink)' : 'var(--color-muted)',
                fontWeight: selected === r.id ? 600 : 400,
              }}
            >
              <span className="block truncate">{r.name}</span>
              <span className="text-xs opacity-60">{r.questionIds.length} questions</span>
            </button>
            <div className="flex items-center pr-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {selectedQIds.length > 0 && (
                <button
                  onClick={() => onAddToRound(r.id)}
                  className="text-xs px-1.5 py-0.5 rounded transition-all"
                  style={{ color: 'var(--color-gold)', background: 'var(--color-gold-light)' }}
                  title="Add selected questions to this round"
                >
                  +add
                </button>
              )}
              <button
                onClick={e => {
                  e.stopPropagation()
                  onEditRound(r)
                }}
                className="text-xs px-1 py-0.5 rounded transition-all hover:bg-black/5"
                style={{ color: 'var(--color-muted)' }}
                title="Rename round"
              >
                ✎
              </button>
              <button
                onClick={e => {
                  e.stopPropagation()
                  onDeleteRound(r)
                }}
                className="text-xs px-1 py-0.5 rounded transition-all hover:bg-black/5"
                style={{ color: 'var(--color-red)' }}
                title="Delete round"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Questions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [difficulties, setDifficulties] = useState<DifficultyLevel[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selectedRound, setSelectedRound] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Partial<Question> | null | false>(false)
  const [newRoundName, setNewRoundName] = useState('')
  const [roundModal, setRoundModal] = useState(false)
  const [editingRound, setEditingRound] = useState<Round | null>(null)
  const [editRoundName, setEditRoundName] = useState('')
  const [deletingRound, setDeletingRound] = useState<Round | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [qs, rs, cats, diffs, ts] = await Promise.all([
      db.questions.orderBy('createdAt').reverse().toArray(),
      db.rounds.toArray(),
      db.categories.toArray(),
      db.difficulties.orderBy('order').toArray(),
      db.tags.toArray(),
    ])
    setQuestions(qs)
    setRounds(rs)
    setCategories(cats)
    setDifficulties(diffs)
    setTags(ts)
  }

  useEffect(() => {
    void load()
  }, [])

  // Build enriched search documents (resolved names for category/difficulty/tags)
  const searchDocs = useMemo(
    () =>
      questions.map(q => ({
        ...q,
        _categoryName: categories.find(c => c.id === q.categoryId)?.name ?? '',
        _difficultyName: difficulties.find(d => d.id === q.difficulty)?.name ?? '',
        _tagNames: q.tags.map(tid => tags.find(t => t.id === tid)?.name ?? '').join(' '),
        _options: q.options.join(' '),
      })),
    [questions, categories, difficulties, tags]
  )

  const fuse = useMemo(
    () =>
      new Fuse(searchDocs, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'answer', weight: 2 },
          { name: '_options', weight: 2 },
          { name: '_categoryName', weight: 1.5 },
          { name: '_difficultyName', weight: 1 },
          { name: '_tagNames', weight: 1 },
          { name: 'description', weight: 0.5 },
        ],
        threshold: 0.35,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [searchDocs]
  )

  // Filter
  const displayed = useMemo(() => {
    // First apply hard filters (round, category, difficulty, type)
    const hardFiltered = questions.filter(q => {
      if (selectedRound) {
        const round = rounds.find(r => r.id === selectedRound)
        if (!round?.questionIds.includes(q.id)) return false
      }
      if (filterCat && q.categoryId !== filterCat) return false
      if (filterDiff && q.difficulty !== filterDiff) return false
      if (filterType && q.type !== filterType) return false
      return true
    })

    if (!search.trim()) return hardFiltered

    // Fuzzy search over the hard-filtered subset
    const filteredIds = new Set(hardFiltered.map(q => q.id))
    return fuse
      .search(search.trim())
      .filter(r => filteredIds.has(r.item.id))
      .map(r => r.item)
  }, [questions, rounds, search, filterCat, filterDiff, filterType, selectedRound, fuse])

  // Sort round questions by round order
  const sorted = useMemo(() => {
    if (!selectedRound) return displayed
    const round = rounds.find(r => r.id === selectedRound)
    if (!round) return displayed
    return [...displayed].sort(
      (a, b) => round.questionIds.indexOf(a.id) - round.questionIds.indexOf(b.id)
    )
  }, [displayed, selectedRound, rounds])

  async function handleSave(
    data: Omit<Question, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) {
    const now = Date.now()
    if (data.id) {
      await db.questions.update(data.id, { ...data, updatedAt: now })
    } else {
      await db.questions.add({
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      } as Question)
    }
    setEditing(false)
    load()
  }

  async function handleDelete(ids: string[]) {
    await db.questions.bulkDelete(ids)
    setSelected(new Set())
    // Remove from rounds
    const rs = await db.rounds.toArray()
    for (const r of rs) {
      if (ids.some(id => r.questionIds.includes(id))) {
        await db.rounds.update(r.id, { questionIds: r.questionIds.filter(id => !ids.includes(id)) })
      }
    }
    load()
  }

  async function handleNewRound() {
    if (!newRoundName.trim()) return
    const round: Round = {
      id: crypto.randomUUID(),
      name: newRoundName.trim(),
      description: '',
      questionIds: [...selected],
      createdAt: Date.now(),
    }
    await db.rounds.add(round)
    setNewRoundName('')
    setRoundModal(false)
    setSelected(new Set())
    load()
  }

  async function handleAddToRound(roundId: string) {
    const round = await db.rounds.get(roundId)
    if (!round) return
    const newIds = [...new Set([...round.questionIds, ...selected])]
    await db.rounds.update(roundId, { questionIds: newIds })
    setSelected(new Set())
    load()
  }

  async function handleSaveRound() {
    if (!editingRound || !editRoundName.trim()) return
    await db.rounds.update(editingRound.id, { name: editRoundName.trim() })
    setEditingRound(null)
    setEditRoundName('')
    load()
  }

  async function handleDeleteRound() {
    if (!deletingRound) return
    await db.rounds.delete(deletingRound.id)
    if (selectedRound === deletingRound.id) setSelectedRound(null)
    setDeletingRound(null)
    load()
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const result = await importQuestions(file)
      setImportResult(result)
      load()
    } catch (err) {
      setImportResult({ imported: 0, skipped: 0, errors: [(err as Error).message] })
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  async function moveInRound(qId: string, dir: -1 | 1) {
    if (!selectedRound) return
    const round = rounds.find(r => r.id === selectedRound)
    if (!round) return
    const ids = [...round.questionIds]
    const i = ids.indexOf(qId)
    if (i + dir < 0 || i + dir >= ids.length) return
    const tmp = ids[i]
    ids[i] = ids[i + dir]
    ids[i + dir] = tmp
    await db.rounds.update(selectedRound, { questionIds: ids })
    load()
  }

  const toggleSelect = useCallback((id: string) => {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(id)) {
        n.delete(id)
      } else {
        n.add(id)
      }
      return n
    })
  }, [])

  const allMatchedSelected = sorted.length > 0 && sorted.every(q => selected.has(q.id))
  const someSelected = selected.size > 0 && !allMatchedSelected

  function toggleSelectAll() {
    if (allMatchedSelected) {
      // Deselect all matched
      setSelected(s => {
        const n = new Set(s)
        sorted.forEach(q => n.delete(q.id))
        return n
      })
    } else {
      // Select all matched (add to any existing selection)
      setSelected(s => {
        const n = new Set(s)
        sorted.forEach(q => n.add(q.id))
        return n
      })
    }
  }

  const catOpts = [
    { value: '', label: 'All categories' },
    ...categories.map(c => ({ value: c.id, label: c.name })),
  ]
  const diffOpts = [
    { value: '', label: 'All difficulties' },
    ...difficulties.map(d => ({ value: d.id, label: d.name })),
  ]
  const typeOpts = [
    { value: '', label: 'All types' },
    { value: 'multiple_choice', label: 'Multiple choice' },
    { value: 'true_false', label: 'True / False' },
    { value: 'open_ended', label: 'Open ended' },
  ]

  return (
    <AdminLayout>
      <div className="flex h-full -mx-8 -my-6" style={{ height: 'calc(100vh - 64px)' }}>
        <RoundSidebar
          rounds={rounds}
          selected={selectedRound}
          onSelect={setSelectedRound}
          onNewRound={() => setRoundModal(true)}
          onEditRound={r => {
            setEditingRound(r)
            setEditRoundName(r.name)
          }}
          onDeleteRound={r => setDeletingRound(r)}
          selectedQIds={[...selected]}
          onAddToRound={handleAddToRound}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div
            className="px-6 py-4 border-b flex flex-wrap items-center gap-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <input
              className="px-3 py-1.5 rounded border text-sm outline-none flex-1 min-w-40"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-cream)' }}
              placeholder="Search questions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Select
              options={catOpts}
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
            />
            <Select
              options={diffOpts}
              value={filterDiff}
              onChange={e => setFilterDiff(e.target.value)}
            />
            <Select
              options={typeOpts}
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            />

            {selected.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setRoundModal(true)}>
                  + Round from {selected.size} selected
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => exportQuestions([...selected])}
                >
                  ↓ Export {selected.size}
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete([...selected])}>
                  Delete {selected.size}
                </Button>
              </>
            )}

            {/* Import */}
            <label>
              <Button
                variant="secondary"
                size="sm"
                disabled={importing}
                onClick={() => importRef.current?.click()}
              >
                {importing ? 'Importing…' : '↑ Import'}
              </Button>
              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImport}
              />
            </label>

            {/* Export all */}
            {selected.size === 0 && (
              <Button variant="secondary" size="sm" onClick={() => exportQuestions()}>
                ↓ Export all
              </Button>
            )}

            <Button variant="primary" size="sm" onClick={() => setEditing({})}>
              + New question
            </Button>
          </div>

          {/* Count / select-all bar */}
          <div
            className="px-6 py-2 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <input
              type="checkbox"
              title={allMatchedSelected ? 'Deselect all' : 'Select all matched'}
              checked={allMatchedSelected}
              ref={el => {
                if (el) el.indeterminate = someSelected
              }}
              onChange={toggleSelectAll}
              className="cursor-pointer"
              disabled={sorted.length === 0}
            />
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {selected.size > 0 ? (
                <>
                  {selected.size} of {sorted.length} selected ·{' '}
                  <button
                    className="underline hover:no-underline"
                    onClick={() => setSelected(new Set())}
                  >
                    Clear
                  </button>
                </>
              ) : (
                <>
                  {sorted.length} question{sorted.length !== 1 ? 's' : ''}
                  {search.trim() ? ' matched' : ''}
                </>
              )}
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <Empty icon="?" message="No questions yet. Add your first one." />
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {sorted.map(q => {
                  const cat = categories.find(c => c.id === q.categoryId)
                  const diff = difficulties.find(d => d.id === q.difficulty)
                  const isSelected = selected.has(q.id)
                  return (
                    <div
                      key={q.id}
                      className="flex items-start gap-3 px-6 py-4 hover:bg-black/[0.02] transition-colors"
                      style={{ background: isSelected ? 'var(--color-gold-light)' : undefined }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(q.id)}
                        className="mt-1 cursor-pointer"
                      />

                      {/* Round reorder arrows */}
                      {selectedRound && (
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <button
                            onClick={() => moveInRound(q.id, -1)}
                            className="text-xs opacity-30 hover:opacity-80 leading-none"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveInRound(q.id, 1)}
                            className="text-xs opacity-30 hover:opacity-80 leading-none"
                          >
                            ▼
                          </button>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm font-medium leading-snug">{q.title}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            {cat && <Badge color={cat.color + '33'}>{cat.name}</Badge>}
                            {diff && <Badge color={diff.color + '33'}>{diff.name}</Badge>}
                            <Badge>{TYPE_LABELS[q.type]}</Badge>
                          </div>
                        </div>
                        {q.answer && (
                          <p className="text-xs mt-1" style={{ color: 'var(--color-green)' }}>
                            ✓ {q.answer}
                          </p>
                        )}
                        {q.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {q.tags.map(tid => {
                              const tag = tags.find(t => t.id === tid)
                              return tag ? (
                                <span
                                  key={tid}
                                  className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: tag.color + '33', color: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              ) : null
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(q)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete([q.id])}
                          style={{ color: 'var(--color-red)' }}
                        >
                          Del
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Question form */}
      {editing !== false && (
        <QuestionForm
          question={editing}
          categories={categories}
          difficulties={difficulties}
          tags={tags}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Import result modal */}
      {importResult && (
        <Modal open title="Import complete" onClose={() => setImportResult(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div
                className="flex-1 rounded-lg border p-3 text-center"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-green)' }}
                >
                  {importResult.imported}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  imported
                </p>
              </div>
              <div
                className="flex-1 rounded-lg border p-3 text-center"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'Playfair Display, serif', color: 'var(--color-muted)' }}
                >
                  {importResult.skipped}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  skipped
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div
                className="rounded-lg border p-3 flex flex-col gap-1"
                style={{ borderColor: 'var(--color-red)', background: '#c0392b11' }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-red)' }}>
                  Errors
                </p>
                {importResult.errors.map((e, i) => (
                  <p key={i} className="text-xs mono" style={{ color: 'var(--color-red)' }}>
                    {e}
                  </p>
                ))}
              </div>
            )}

            <div
              className="flex items-center justify-between pt-2 border-t"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <button
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-muted)' }}
                onClick={downloadExampleQuestions}
              >
                ↓ Download example file
              </button>
              <Button variant="primary" onClick={() => setImportResult(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* New round modal */}
      <Modal open={roundModal} title="Create round" onClose={() => setRoundModal(false)}>
        <div className="flex flex-col gap-4">
          <Input
            label="Round name"
            value={newRoundName}
            onChange={e => setNewRoundName(e.target.value)}
            placeholder="e.g. Round 1 – Pop Culture"
          />
          {selected.size > 0 && (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              {selected.size} selected question{selected.size > 1 ? 's' : ''} will be added to this
              round.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRoundModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleNewRound} disabled={!newRoundName.trim()}>
              Create round
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit round modal */}
      <Modal open={!!editingRound} title="Rename round" onClose={() => setEditingRound(null)}>
        <div className="flex flex-col gap-4">
          <Input
            label="Round name"
            value={editRoundName}
            onChange={e => setEditRoundName(e.target.value)}
            placeholder="e.g. Round 1 – Pop Culture"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingRound(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveRound} disabled={!editRoundName.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete round confirm modal */}
      <Modal open={!!deletingRound} title="Delete round" onClose={() => setDeletingRound(null)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
            Delete <strong>{deletingRound?.name}</strong>? The questions inside will not be deleted.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeletingRound(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteRound}>
              Delete round
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  )
}
