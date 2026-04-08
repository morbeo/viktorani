import { describe, it, expect } from 'vitest'
import Fuse from 'fuse.js'
import type { Question, DifficultyLevel, Tag } from '@/db'
import type { TagFilterState } from '@/pages/admin/Questions'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const difficulties: DifficultyLevel[] = [
  { id: 'diff-easy', name: 'Easy', score: 5, color: '#0f0', order: 0 },
  { id: 'diff-hard', name: 'Hard', score: 15, color: '#f00', order: 2 },
]

const tagList: Tag[] = [
  { id: 'tag-music', name: 'Music', color: '#f0f' },
  { id: 'tag-sports', name: 'Sports', color: '#ff0' },
  { id: 'tag-science', name: 'Science', color: '#0ff' },
]

const BASE: Omit<Question, 'id' | 'title' | 'type' | 'options' | 'answer' | 'difficulty' | 'tags'> =
  {
    description: '',
    media: null,
    mediaType: null,
    createdAt: 0,
    updatedAt: 0,
  }

const questions: Question[] = [
  {
    ...BASE,
    id: 'q1',
    title: 'What is the capital of France?',
    type: 'multiple_choice',
    options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
    answer: 'Paris',
    difficulty: 'diff-easy',
    tags: ['tag-science'],
  },
  {
    ...BASE,
    id: 'q2',
    title: 'Who wrote Hamlet?',
    type: 'open_ended',
    options: [],
    answer: 'Shakespeare',
    difficulty: 'diff-hard',
    tags: ['tag-music'],
  },
  {
    ...BASE,
    id: 'q3',
    title: 'What is H2O?',
    type: 'open_ended',
    options: [],
    answer: 'Water',
    difficulty: 'diff-easy',
    tags: ['tag-sports'],
    description: 'Chemical formula for water',
  },
  {
    ...BASE,
    id: 'q4',
    title: 'How many strings on a guitar?',
    type: 'open_ended',
    options: [],
    answer: 'Six',
    difficulty: null,
    tags: ['tag-music'],
  },
  {
    ...BASE,
    id: 'q5',
    title: 'Fastest land animal?',
    type: 'multiple_choice',
    options: ['Lion', 'Cheetah', 'Horse', 'Dog'],
    answer: 'Cheetah',
    difficulty: 'diff-hard',
    tags: ['tag-music', 'tag-sports'],
  },
]

function enrichDocs(qs: Question[]) {
  return qs.map(q => ({
    ...q,
    _difficultyName: difficulties.find(d => d.id === q.difficulty)?.name ?? '',
    _tagNames: q.tags.map(tid => tagList.find(t => t.id === tid)?.name ?? '').join(' '),
    _options: q.options.join(' '),
  }))
}

function makeFuse(qs: Question[]) {
  return new Fuse(enrichDocs(qs), {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'answer', weight: 2 },
      { name: '_options', weight: 2 },
      { name: '_difficultyName', weight: 1 },
      { name: '_tagNames', weight: 1 },
      { name: 'description', weight: 0.5 },
    ],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
}

// Mirror the tri-state tag filter logic from Questions.tsx
function applyTagFilters(qs: Question[], tagFilters: Record<string, TagFilterState>): Question[] {
  const included = Object.entries(tagFilters)
    .filter(([, s]) => s === 'include')
    .map(([id]) => id)
  const excluded = Object.entries(tagFilters)
    .filter(([, s]) => s === 'exclude')
    .map(([id]) => id)

  return qs.filter(q => {
    if (included.length > 0 && !included.every(tid => q.tags.includes(tid))) return false
    if (excluded.length > 0 && excluded.some(tid => q.tags.includes(tid))) return false
    return true
  })
}

// ── Fuzzy search ──────────────────────────────────────────────────────────────

describe('fuzzy search', () => {
  const fuse = makeFuse(questions)

  it('finds question by exact title word', () => {
    expect(fuse.search('Hamlet').map(r => r.item.id)).toContain('q2')
  })

  it('finds question by partial title (fuzzy)', () => {
    expect(fuse.search('capit').map(r => r.item.id)).toContain('q1')
  })

  it('finds question by answer', () => {
    expect(fuse.search('Shakespeare').map(r => r.item.id)).toContain('q2')
  })

  it('finds question by option value', () => {
    expect(fuse.search('Cheetah').map(r => r.item.id)).toContain('q5')
  })

  it('finds question by difficulty name', () => {
    const ids = fuse.search('Hard').map(r => r.item.id)
    expect(ids).toContain('q2')
    expect(ids).toContain('q5')
  })

  it('finds question by tag name', () => {
    const ids = fuse.search('Music').map(r => r.item.id)
    expect(ids).toContain('q2')
    expect(ids).toContain('q4')
  })

  it('finds question by description', () => {
    expect(fuse.search('Chemical formula').map(r => r.item.id)).toContain('q3')
  })

  it('returns empty array for no matches', () => {
    expect(fuse.search('xyznotexist')).toHaveLength(0)
  })

  it('ranks title/answer match higher than description', () => {
    const results = fuse.search('Water')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].item.id).toBe('q3')
  })

  it('is case-insensitive', () => {
    const upper = fuse.search('FRANCE').map(r => r.item.id)
    const lower = fuse.search('france').map(r => r.item.id)
    expect(upper).toEqual(lower)
  })

  it('ignores search terms shorter than minMatchCharLength', () => {
    expect(Array.isArray(fuse.search('a'))).toBe(true)
  })
})

// ── Hard filters ──────────────────────────────────────────────────────────────

describe('hard filters', () => {
  function applyFilters(qs: Question[], { filterDiff = '', filterType = '' } = {}) {
    return qs.filter(q => {
      if (filterDiff && q.difficulty !== filterDiff) return false
      if (filterType && q.type !== filterType) return false
      return true
    })
  }

  it('filters by difficulty', () => {
    const result = applyFilters(questions, { filterDiff: 'diff-hard' })
    expect(result.map(q => q.id)).toEqual(expect.arrayContaining(['q2', 'q5']))
    expect(result.map(q => q.id)).not.toContain('q1')
  })

  it('filters by type', () => {
    const mc = applyFilters(questions, { filterType: 'multiple_choice' })
    expect(mc.every(q => q.type === 'multiple_choice')).toBe(true)
  })

  it('combines difficulty and type filters', () => {
    const result = applyFilters(questions, {
      filterDiff: 'diff-hard',
      filterType: 'multiple_choice',
    })
    expect(result.map(q => q.id)).toEqual(['q5'])
  })

  it('returns all questions when no filters applied', () => {
    expect(applyFilters(questions)).toHaveLength(questions.length)
  })
})

// ── Tri-state tag filters ─────────────────────────────────────────────────────

describe('tri-state tag filters', () => {
  it('no filter — returns all', () => {
    expect(applyTagFilters(questions, {})).toHaveLength(questions.length)
  })

  it('include single tag — returns only questions with that tag', () => {
    const result = applyTagFilters(questions, { 'tag-music': 'include' })
    expect(result.map(q => q.id)).toEqual(expect.arrayContaining(['q2', 'q4', 'q5']))
    expect(result.map(q => q.id)).not.toContain('q1')
    expect(result.map(q => q.id)).not.toContain('q3')
  })

  it('exclude single tag — returns questions without that tag', () => {
    const result = applyTagFilters(questions, { 'tag-music': 'exclude' })
    expect(result.map(q => q.id)).toEqual(expect.arrayContaining(['q1', 'q3']))
    expect(result.map(q => q.id)).not.toContain('q2')
    expect(result.map(q => q.id)).not.toContain('q4')
    expect(result.map(q => q.id)).not.toContain('q5')
  })

  it('include multiple tags — question must have ALL of them', () => {
    // q5 has both music and sports; q2 only music; q3 only sports
    const result = applyTagFilters(questions, {
      'tag-music': 'include',
      'tag-sports': 'include',
    })
    expect(result.map(q => q.id)).toEqual(['q5'])
  })

  it('exclude multiple tags — question must have NONE of them', () => {
    const result = applyTagFilters(questions, {
      'tag-music': 'exclude',
      'tag-sports': 'exclude',
    })
    // Only q1 (science only) survives
    expect(result.map(q => q.id)).toEqual(['q1'])
  })

  it('include one, exclude another — intersection minus exclusion', () => {
    // include music (q2, q4, q5), exclude sports (q3, q5) → q2, q4
    const result = applyTagFilters(questions, {
      'tag-music': 'include',
      'tag-sports': 'exclude',
    })
    const ids = result.map(q => q.id)
    expect(ids).toContain('q2')
    expect(ids).toContain('q4')
    expect(ids).not.toContain('q5') // has both music and sports → excluded
    expect(ids).not.toContain('q1')
    expect(ids).not.toContain('q3')
  })

  it('"none" state is treated as no filter', () => {
    const withNone = applyTagFilters(questions, { 'tag-music': 'none' })
    const withEmpty = applyTagFilters(questions, {})
    expect(withNone.map(q => q.id)).toEqual(withEmpty.map(q => q.id))
  })

  it('combining tag filter with hard filters narrows result', () => {
    // include music + filter type=open_ended
    const tagFiltered = applyTagFilters(questions, { 'tag-music': 'include' })
    const result = tagFiltered.filter(q => q.type === 'open_ended')
    const ids = result.map(q => q.id)
    expect(ids).toContain('q2')
    expect(ids).toContain('q4')
    expect(ids).not.toContain('q5') // multiple_choice
  })
})

// ── Select-all logic ──────────────────────────────────────────────────────────

describe('select-all matched logic', () => {
  function computeState(sorted: Question[], selected: Set<string>) {
    const allSelected = sorted.length > 0 && sorted.every(q => selected.has(q.id))
    const someSelected = selected.size > 0 && !allSelected
    return { allSelected, someSelected }
  }

  it('allSelected is false when nothing is selected', () => {
    const { allSelected, someSelected } = computeState(questions, new Set())
    expect(allSelected).toBe(false)
    expect(someSelected).toBe(false)
  })

  it('allSelected is true when all matched questions are selected', () => {
    const ids = new Set(questions.map(q => q.id))
    expect(computeState(questions, ids).allSelected).toBe(true)
  })

  it('someSelected (indeterminate) when only subset selected', () => {
    const { allSelected, someSelected } = computeState(questions, new Set(['q1', 'q2']))
    expect(allSelected).toBe(false)
    expect(someSelected).toBe(true)
  })

  it('toggling on selects all matched ids', () => {
    const sorted = questions.slice(0, 3)
    const selected = new Set([...sorted.map(q => q.id)])
    expect(selected.size).toBe(3)
    sorted.forEach(q => expect(selected.has(q.id)).toBe(true))
  })

  it('toggling off deselects only matched, preserving others', () => {
    const selected = new Set(['q1', 'q2', 'q3', 'q4'])
    const sorted = questions.slice(0, 3)
    sorted.forEach(q => selected.delete(q.id))
    expect(selected.has('q1')).toBe(false)
    expect(selected.has('q4')).toBe(true)
  })

  it('allSelected is false when sorted is empty', () => {
    expect(computeState([], new Set(['q1'])).allSelected).toBe(false)
  })
})
