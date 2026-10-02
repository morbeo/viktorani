// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Questions from '@/pages/admin/Questions'
import { db } from '@/db'
import { setSettings } from '@/lib/app-settings'

vi.mock('@/components/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

beforeEach(async () => {
  localStorage.clear()
  await db.questions.clear()
  await db.questions.add({
    id: 'q1',
    title: 'Capital of France?',
    type: 'open_ended',
    options: [],
    answer: 'Paris',
    description: '',
    difficulty: null,
    tags: [],
    media: null,
    mediaType: null,
    createdAt: 0,
    updatedAt: 0,
  })
})

function renderQuestions() {
  render(
    <MemoryRouter>
      <Questions />
    </MemoryRouter>
  )
}

describe('deleting a question', () => {
  it('asks first by default', async () => {
    renderQuestions()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete question' }))
    expect(await screen.findByText(/Delete this question\?/)).toBeInTheDocument()
    expect(await db.questions.count()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect(await db.questions.count()).toBe(0))
  })

  it('deletes straight away when confirmations are off', async () => {
    setSettings({ confirmDestructive: false })
    renderQuestions()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete question' }))
    await waitFor(async () => expect(await db.questions.count()).toBe(0))
    expect(screen.queryByText(/Delete this question\?/)).not.toBeInTheDocument()
  })
})
