import { z } from 'zod'
import type { ScoreboardRow } from '@/transport/types'

/** Settings of the leaderboard widget; they travel to screens in `LAYOUT`. */
export const LeaderboardConfigSchema = z.strictObject({
  title: z.string().max(60).meta({ description: 'Title' }).default('Leaderboard'),
  places: z.number().int().min(1).max(10).meta({ description: 'Places shown' }).default(3),
})
export type LeaderboardConfig = z.infer<typeof LeaderboardConfigSchema>

/** A row with its place: equal scores share one, and the next place skips ahead (1, 2, 2, 4). */
export interface RankedRow extends ScoreboardRow {
  place: number
}

/**
 * The top `places` places of `rows` (already sorted, highest score first). Everyone tied
 * for the last place shown is kept, so a tie is never cut in half.
 */
export function topPlaces(rows: readonly ScoreboardRow[], places: number): RankedRow[] {
  const ranked: RankedRow[] = []
  rows.forEach((row, i) => {
    const prev = ranked[i - 1]
    ranked.push({ ...row, place: prev && prev.score === row.score ? prev.place : i + 1 })
  })
  return ranked.filter(r => r.place <= places)
}
