import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button, Icon, Input } from '@/components/ui'
import type { Question, Tag } from '@/db'

/** A round built in the new-game wizard, saved together with the game. */
export interface DraftRound {
  id: string
  name: string
  questionIds: string[]
}

interface RoundBuilderProps {
  value: DraftRound[]
  onChange: (rounds: DraftRound[]) => void
  questions: Question[]
  tags: Tag[]
}

/** Name rounds, pick their questions and order them, without leaving the wizard. */
export function RoundBuilder({ value, onChange, questions, tags }: RoundBuilderProps) {
  const [openId, setOpenId] = useState<string | null>(value[0]?.id ?? null)

  function patch(id: string, change: Partial<DraftRound>) {
    onChange(value.map(r => (r.id === id ? { ...r, ...change } : r)))
  }

  function add() {
    const round = { id: crypto.randomUUID(), name: `Round ${value.length + 1}`, questionIds: [] }
    onChange([...value, round])
    setOpenId(round.id)
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...value]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    onChange(next)
  }

  if (questions.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
        No questions yet. Add some on the Questions page first.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((round, i) => (
        <div
          key={round.id}
          className="rounded-lg border"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-center gap-2 p-2">
            <span className="mono text-xs w-5 text-center" style={{ color: 'var(--color-muted)' }}>
              {i + 1}
            </span>
            <input
              value={round.name}
              onChange={e => patch(round.id, { name: e.target.value })}
              aria-label={`Name of round ${i + 1}`}
              className="flex-1 min-w-0 px-2 py-1 rounded border text-sm outline-none"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-cream)',
                color: 'var(--color-ink)',
              }}
            />
            <button
              onClick={() => setOpenId(openId === round.id ? null : round.id)}
              aria-expanded={openId === round.id}
              className="text-xs px-2 py-1 rounded hover:opacity-70"
              style={{
                color: round.questionIds.length ? 'var(--color-ink)' : 'var(--color-red)',
              }}
            >
              {round.questionIds.length} question{round.questionIds.length !== 1 ? 's' : ''}
            </button>
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={`Move round ${i + 1} up`}
              className="p-1 hover:opacity-60 disabled:opacity-30"
            >
              <Icon icon={ArrowUp} size="sm" />
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              aria-label={`Move round ${i + 1} down`}
              className="p-1 hover:opacity-60 disabled:opacity-30"
            >
              <Icon icon={ArrowDown} size="sm" />
            </button>
            <button
              onClick={() => onChange(value.filter(r => r.id !== round.id))}
              aria-label={`Remove round ${i + 1}`}
              className="p-1 hover:opacity-60"
            >
              <Icon icon={Trash2} size="sm" />
            </button>
          </div>
          {openId === round.id && (
            <QuestionPicker
              label={round.name || `round ${i + 1}`}
              selected={round.questionIds}
              onChange={questionIds => patch(round.id, { questionIds })}
              questions={questions}
              tags={tags}
            />
          )}
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" onClick={add}>
          <Icon icon={Plus} size="sm" />
          Add round
        </Button>
      </div>
    </div>
  )
}

function QuestionPicker({
  label,
  selected,
  onChange,
  questions,
  tags,
}: {
  label: string
  selected: string[]
  onChange: (ids: string[]) => void
  questions: Question[]
  tags: Tag[]
}) {
  const [search, setSearch] = useState('')
  const [tagId, setTagId] = useState('')

  const fuse = useMemo(
    () => new Fuse(questions, { keys: ['title'], threshold: 0.35, ignoreLocation: true }),
    [questions]
  )
  const q = search.trim()
  const shown = (q ? fuse.search(q).map(r => r.item) : questions).filter(
    question => !tagId || question.tags.includes(tagId)
  )

  // Keep the picked order: new picks go to the end of the round
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div className="border-t p-2 flex flex-col gap-2" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions"
            aria-label={`Search questions for ${label}`}
          />
        </div>
        {tags.length > 0 && (
          <select
            value={tagId}
            onChange={e => setTagId(e.target.value)}
            aria-label="Filter by tag"
            className="px-2 py-2 rounded border text-sm outline-none"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-cream)',
              color: 'var(--color-ink)',
            }}
          >
            <option value="">Any tag</option>
            {tags.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <ul className="max-h-56 overflow-y-auto flex flex-col" aria-label={`Questions for ${label}`}>
        {shown.map(question => (
          <li key={question.id}>
            <label className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(question.id)}
                onChange={() => toggle(question.id)}
              />
              <span className="truncate">{question.title}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="px-1 py-2 text-sm" style={{ color: 'var(--color-muted)' }}>
            No matching questions
          </li>
        )}
      </ul>
    </div>
  )
}
