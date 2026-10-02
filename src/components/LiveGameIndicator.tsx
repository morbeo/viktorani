import { Link } from 'react-router-dom'
import { Pause } from 'lucide-react'
import { Icon } from '@/components/ui'
import { describeLiveGame } from '@/hooks/useLiveGames'
import type { LiveGame } from '@/hooks/useLiveGames'

interface LiveGameIndicatorProps {
  /** Running games; render nothing when empty. */
  live: LiveGame[]
  collapsed: boolean
}

/**
 * Marker next to Games in the sidebar while a game is running: a pulsing dot when
 * any game is active, a pause glyph when all are paused. Opens the game's host page,
 * or the Games list when several are running.
 */
export function LiveGameIndicator({ live, collapsed }: LiveGameIndicatorProps) {
  if (live.length === 0) return null
  const anyActive = live.some(l => l.game.status === 'active')
  const description =
    live.length === 1
      ? describeLiveGame(live[0])
      : `${live.length} games running. ${live.map(describeLiveGame).join('. ')}`
  const to = live.length === 1 ? `/admin/game/${live[0].game.id}` : '/admin/games'

  return (
    <Link
      to={to}
      aria-label={description}
      title={description}
      data-status={anyActive ? 'active' : 'paused'}
      className={`absolute flex items-center justify-center rounded-full ${
        collapsed ? 'top-0.5 right-0.5 w-4 h-4' : 'right-2 top-1/2 -translate-y-1/2 w-6 h-6'
      } hover:bg-black/5`}
    >
      {anyActive ? (
        <span className="relative flex w-2.5 h-2.5">
          <span
            className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping"
            style={{ background: 'var(--color-green)' }}
          />
          <span
            className="relative inline-flex w-2.5 h-2.5 rounded-full"
            style={{ background: 'var(--color-green)' }}
          />
        </span>
      ) : (
        <span style={{ color: 'var(--color-gold)' }}>
          <Icon icon={Pause} size="sm" />
        </span>
      )}
    </Link>
  )
}
