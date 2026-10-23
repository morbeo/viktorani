import { ScreenLeaderboard, ScreenLog } from '@/components/screen/screen-widgets'
import type { LeaderboardConfig } from '@/widgets/leaderboard'
import type { ScoreboardData, WidgetProps } from '@/widgets/types'

/** The scoreboard surface's leaderboard: the projector's, on the scoreboard's data. */
export function ScoreboardLeaderboardWidget({
  data,
  config,
}: WidgetProps<ScoreboardData, LeaderboardConfig>) {
  return <ScreenLeaderboard rows={data.rows} {...config} />
}

/** The scoreboard surface's game log: the projector's, on the scoreboard's data. */
export function ScoreboardLogWidget({ data }: WidgetProps<ScoreboardData>) {
  return <ScreenLog entries={data.logEntries} />
}
