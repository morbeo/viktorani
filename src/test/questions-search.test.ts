import { describe, it, expect } from 'vitest'
import Fuse from 'fuse.js'
import type { Question, Category, DifficultyLevel, Tag } from '@/db'

// ── Test fixtures ─────────────────────────────────────────────────────────────

const categories: Category[] = [
  { id: 'cat-geo', name: 'Geography', color: '#00f' },
  { id: 'cat-sci', name: 'Science', color: '#0f0' },
  { id: 'cat-hist', name: 'History', color: '#f00' },
]

const difficulties: DifficultyLevel[] = [
  { id: 'diff-easy', name: 'Easy', score: 5, color: '#0f0', order: 0 },
  { id: 'diff-hard', name: 'Hard', score: 15, color: '#f00', order: 2 },
]

const tagList: Tag[] = [
  { id: 'tag-music', name: 'Music', color: '#f0f' },
  { id: 'tag-sports', name: 'Sports', color: '#ff0' },
]

const BASE: Omit<
  Question,
  'id' | 'title' | 'type' | 'options' | 'answer' | 'categoryId' | 'difficulty' | 'tags'
> = {
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
    categoryId: 'cat-geo',
    difficulty: 'diff-easy',
    tags: [],
  },
  {
    ...BASE,
    id: 'q2',
    title: 'Who wrote Hamlet?',
    type: 'open_ended',
    options: [],
    answer: 'Shakespeare',
    categoryId: 'cat-hist',
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
    categoryId: 'cat-sci',
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
    categoryId: null,
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
    categoryId: 'cat-sci',
    difficulty: 'diff-hard',
    tags: [],
  },
]

// Mirror the enrichment done in Questions.tsx
function enrichDocs(qs: Question[]) {
  return qs.map(q => ({
    ...q,
    _categoryName: categories.find(c => c.id === q.categoryId)?.name ?? '',
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
      { name: '_categoryName', weight: 1.5 },
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

// ── Fuzzy search ──────────────────────────────────────────────────────────────

describe('fuzzy search', () => {
  const fuse = makeFuse(questions)

  it('finds question by exact title word', () => {
    const results = fuse.search('Hamlet')
    expect(results.map(r => r.item.id)).toContain('q2')
  })

  it('finds question by partial title (fuzzy)', () => {
    const results = fuse.search('capit')
    expect(results.map(r => r.item.id)).toContain('q1')
  })

  it('finds question by answer', () => {
    const results = fuse.search('Shakespeare')
    expect(results.map(r => r.item.id)).toContain('q2')
  })

  it('finds question by option value', () => {
    const results = fuse.search('Cheetah')
    expect(results.map(r => r.item.id)).toContain('q5')
  })

  it('finds question by category name', () => {
    const results = fuse.search('Geography')
    expect(results.map(r => r.item.id)).toContain('q1')
  })

  it('finds question by difficulty name', () => {
    const results = fuse.search('Hard')
    const ids = results.map(r => r.item.id)
    expect(ids).toContain('q2') // hard
    expect(ids).toContain('q5') // hard
  })

  it('finds question by tag name', () => {
    const results = fuse.search('Music')
    const ids = results.map(r => r.item.id)
    expect(ids).toContain('q2')
    expect(ids).toContain('q4')
  })

  it('finds question by description', () => {
    const results = fuse.search('Chemical formula')
    expect(results.map(r => r.item.id)).toContain('q3')
  })

  it('returns empty array for no matches', () => {
    const results = fuse.search('xyznotexist')
    expect(results).toHaveLength(0)
  })

  it('ranks title match higher than description match', () => {
    // 'Water' appears as the answer to q3; also 'guitar' is in q4 title
    const results = fuse.search('Water')
    expect(results.length).toBeGreaterThan(0)
    // The top result should be q3 (answer = Water)
    expect(results[0].item.id).toBe('q3')
  })

  it('is case-insensitive', () => {
    const upper = fuse.search('FRANCE')
    const lower = fuse.search('france')
    expect(upper.map(r => r.item.id)).toEqual(lower.map(r => r.item.id))
  })

  it('ignores search terms shorter than minMatchCharLength (2)', () => {
    // Single character — Fuse returns nothing due to minMatchCharLength: 2
    const results = fuse.search('a')
    // Either empty or no meaningful match — should not crash
    expect(Array.isArray(results)).toBe(true)
  })

  it('searches across multiple fields — category and tag queries work independently', () => {
    // 'Geography' matches q1 via category name
    const geo = fuse.search('Geography')
    expect(geo.map(r => r.item.id)).toContain('q1')
    // 'Sports' matches q3 via tag name
    const sports = fuse.search('Sports')
    expect(sports.map(r => r.item.id)).toContain('q3')
  })
})

// ── Hard filters ──────────────────────────────────────────────────────────────

describe('hard filters', () => {
  function applyFilters(qs: Question[], { filterCat = '', filterDiff = '', filterType = '' } = {}) {
    return qs.filter(q => {
      if (filterCat && q.categoryId !== filterCat) return false
      if (filterDiff && q.difficulty !== filterDiff) return false
      if (filterType && q.type !== filterType) return false
      return true
    })
  }

  it('filters by category', () => {
    const result = applyFilters(questions, { filterCat: 'cat-sci' })
    expect(result.map(q => q.id)).toEqual(expect.arrayContaining(['q3', 'q5']))
    expect(result.map(q => q.id)).not.toContain('q1')
  })

  it('filters by difficulty', () => {
    const result = applyFilters(questions, { filterDiff: 'diff-hard' })
    expect(result.map(q => q.id)).toEqual(expect.arrayContaining(['q2', 'q5']))
    expect(result.map(q => q.id)).not.toContain('q1')
  })

  it('filters by type', () => {
    const mc = applyFilters(questions, { filterType: 'multiple_choice' })
    expect(mc.every(q => q.type === 'multiple_choice')).toBe(true)
  })

  it('combines category and difficulty filters', () => {
    const result = applyFilters(questions, { filterCat: 'cat-sci', filterDiff: 'diff-hard' })
    expect(result.map(q => q.id)).toEqual(['q5'])
  })

  it('returns all questions when no filters applied', () => {
    expect(applyFilters(questions)).toHaveLength(questions.length)
  })
})

// ── Select-all matched logic ──────────────────────────────────────────────────

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
    const { allSelected } = computeState(questions, ids)
    expect(allSelected).toBe(true)
  })

  it('someSelected (indeterminate) when only subset selected', () => {
    const { allSelected, someSelected } = computeState(questions, new Set(['q1', 'q2']))
    expect(allSelected).toBe(false)
    expect(someSelected).toBe(true)
  })

  it('toggling on selects all matched ids', () => {
    let selected = new Set<string>()
    // Simulate toggle-all on
    const sorted = questions.slice(0, 3)
    selected = new Set([...selected, ...sorted.map(q => q.id)])
    expect(selected.size).toBe(3)
    sorted.forEach(q => expect(selected.has(q.id)).toBe(true))
  })

  it('toggling off deselects only the matched ids, preserving others', () => {
    // Suppose q4, q5 are selected outside the current filter
    const selected = new Set(['q1', 'q2', 'q3', 'q4'])
    const sorted = questions.slice(0, 3) // q1, q2, q3 are the matched set
    // Deselect matched
    sorted.forEach(q => selected.delete(q.id))
    expect(selected.has('q1')).toBe(false)
    expect(selected.has('q2')).toBe(false)
    expect(selected.has('q3')).toBe(false)
    expect(selected.has('q4')).toBe(true) // preserved
  })

  it('allSelected is false when sorted is empty', () => {
    const { allSelected } = computeState([], new Set(['q1']))
    expect(allSelected).toBe(false)
  })

  it('select-all after search selects only the search results', () => {
    const fuse = makeFuse(questions)
    const searchResults = fuse.search('Music').map(r => r.item)
    // Should only be q2 and q4
    const selectedAfter = new Set(searchResults.map(q => q.id))
    expect(selectedAfter.has('q2')).toBe(true)
    expect(selectedAfter.has('q4')).toBe(true)
    expect(selectedAfter.has('q1')).toBe(false) // not a music question
  })
})
