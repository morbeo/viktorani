import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { RoundBuilder } from '@/components/games/RoundBuilder'
import type { DraftRound } from '@/components/games/RoundBuilder'
import type { Question, Tag } from '@/db'

function question(id: string, title: string, tags: string[] = []): Question {
  return {
    id,
    title,
    type: 'open_ended',
    options: [],
    answer: '',
    description: '',
    difficulty: null,
    tags,
    media: null,
    mediaType: null,
    createdAt: 0,
    updatedAt: 0,
  }
}

const QUESTIONS = [
  question('q1', 'Capital of France', ['geo']),
  question('q2', 'Longest river', ['geo']),
  question('q3', 'Who painted the Mona Lisa'),
]
const TAGS: Tag[] = [{ id: 'geo', name: 'Geography', color: '#00f' }]

let latest: DraftRound[] = []

function Harness() {
  const [rounds, setRounds] = useState<DraftRound[]>([])
  latest = rounds
  return <RoundBuilder value={rounds} onChange={setRounds} questions={QUESTIONS} tags={TAGS} />
}

const addRound = () => fireEvent.click(screen.getByRole('button', { name: 'Add round' }))

describe('RoundBuilder', () => {
  it('adds a round and picks its questions with search and the tag filter', () => {
    render(<Harness />)
    addRound()
    expect(screen.getByRole('textbox', { name: 'Name of round 1' })).toHaveValue('Round 1')

    fireEvent.change(screen.getByRole('textbox', { name: /Search questions/ }), {
      target: { value: 'capital' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Capital of France' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Search questions/ }), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by tag' }), {
      target: { value: 'geo' },
    })
    const list = screen.getByRole('list', { name: /Questions for/ })
    expect(within(list).queryByText('Who painted the Mona Lisa')).not.toBeInTheDocument()
    fireEvent.click(within(list).getByRole('checkbox', { name: 'Longest river' }))

    expect(latest).toEqual([
      expect.objectContaining({ name: 'Round 1', questionIds: ['q1', 'q2'] }),
    ])
    expect(screen.getByRole('button', { name: '2 questions' })).toBeInTheDocument()
  })

  it('reorders, renames and removes rounds', () => {
    render(<Harness />)
    addRound()
    addRound()
    fireEvent.change(screen.getByRole('textbox', { name: 'Name of round 2' }), {
      target: { value: 'Music' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Move round 2 up' }))
    expect(latest.map(r => r.name)).toEqual(['Music', 'Round 1'])
    expect(screen.getByRole('button', { name: 'Move round 1 up' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove round 1' }))
    expect(latest.map(r => r.name)).toEqual(['Round 1'])
  })

  it('points to the Questions page when there are no questions', () => {
    render(<RoundBuilder value={[]} onChange={() => {}} questions={[]} tags={[]} />)
    expect(screen.getByText(/No questions yet/)).toBeInTheDocument()
  })
})
