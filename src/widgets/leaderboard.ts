import { z } from 'zod'
import type { ScoreboardRow } from '@/transport/types'

/** Settings of the leaderboard widget; they travel to screens in `LAYOUT`. */
export const LeaderboardConfigSchema = z.strictObject({
  title: z.string().max(60).meta({ description: 'Title' }).default('Leaderboard'),
  places: z.number().int().min(1).max(10).meta({ description: 'Places shown' }).default(3),
})
export type LeaderboardConfig = z.infer<typeof LeaderboardConfigSchema>

/**
 * The top `places` places of `rows` (already in standings order, each with its place: tied
 * rows share one, and the next place skips ahead, 1, 2, 2, 4). Everyone tied for the last
 * place shown is kept, so a tie is never cut in half.
 */
export function topPlaces(rows: readonly ScoreboardRow[], places: number): ScoreboardRow[] {
  return rows.filter(r => r.place <= places)
}
