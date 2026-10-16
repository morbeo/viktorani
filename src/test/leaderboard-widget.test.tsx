import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ScreenLeaderboardWidget } from '@/components/screen/screen-widgets'
import { LeaderboardConfigSchema, topPlaces } from '@/widgets/leaderboard'
import { WIDGET_REGISTRY } from '@/widgets/registry'
import type { ScoreboardRow } from '@/transport/types'
import type { ScreenData } from '@/widgets/types'

const row = (id: string, score: number): ScoreboardRow => ({ id, name: id, score })

describe('topPlaces', () => {
  it('gives equal scores the same place and skips ahead after them', () => {
    const rows = [row('a', 9), row('b', 7), row('c', 7), row('d', 5)]
    expect(topPlaces(rows, 10).map(r => [r.id, r.place])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['d', 4],
    ])
  })

  it('keeps everyone tied for the last place shown', () => {
    const rows = [row('a', 9), row('b', 7), row('c', 7), row('d', 5)]
    expect(topPlaces(rows, 2).map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(topPlaces(rows, 3).map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('is empty for no rows', () => {
    expect(topPlaces([], 3)).toEqual([])
  })
})

describe('ScreenLeaderboardWidget', () => {
  const data = (rows: ScoreboardRow[]) => ({ rows }) as ScreenData
  const config = (patch: object = {}) => LeaderboardConfigSchema.parse(patch)

  it('shows the top three places by default, under its title', () => {
    const rows = [row('Ann', 12), row('Bob', 9), row('Cy', 5), row('Di', 2)]
    render(<ScreenLeaderboardWidget data={data(rows)} config={config()} />)
    const board = screen.getByRole('region', { name: 'Leaderboard' })
    expect(within(board).getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument()
    const items = within(board).getAllByRole('listitem')
    expect(items.map(li => li.textContent)).toEqual(['1Ann12', '2Bob9', '3Cy5'])
  })

  it('takes its title and number of places from its settings', () => {
    const rows = [row('Ann', 12), row('Bob', 9)]
    render(
      <ScreenLeaderboardWidget data={data(rows)} config={config({ title: 'Top', places: 1 })} />
    )
    expect(screen.getByRole('heading', { name: 'Top' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('renders nothing without scores', () => {
    const { container } = render(<ScreenLeaderboardWidget data={data([])} config={config()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('refuses settings out of range', () => {
    expect(LeaderboardConfigSchema.safeParse({ places: 0 }).success).toBe(false)
    expect(LeaderboardConfigSchema.safeParse({ places: 11 }).success).toBe(false)
    expect(LeaderboardConfigSchema.safeParse({ title: 'x'.repeat(61) }).success).toBe(false)
  })

  it('is registered for the screen', () => {
    expect(WIDGET_REGISTRY.leaderboard.components.screen).toBe(ScreenLeaderboardWidget)
  })
})
