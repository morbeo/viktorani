import { CircleDot, EyeOff, LogOut, UserX, WifiOff, type LucideIcon } from 'lucide-react'
import type { PlayerPresence } from '@/db'

/** How each presence is shown: icon, colour, short label and what it means. */
export const PRESENCE: Record<
  PlayerPresence,
  { icon: LucideIcon; color: string; label: string; meaning: string }
> = {
  connected: {
    icon: CircleDot,
    color: 'var(--color-positive)',
    label: 'Connected',
    meaning: 'Playing.',
  },
  hidden: {
    icon: EyeOff,
    color: 'var(--color-accent)',
    label: 'Tab hidden',
    meaning: 'Connected, but looking at something else.',
  },
  disconnected: {
    icon: WifiOff,
    color: 'var(--color-muted)',
    label: 'Disconnected',
    meaning: 'Not connected. They can rejoin from their device if rejoining is allowed.',
  },
  left: {
    icon: LogOut,
    color: 'var(--color-muted)',
    label: 'Left',
    meaning: 'They left the game.',
  },
  kicked: {
    icon: UserX,
    color: 'var(--color-negative)',
    label: 'Kicked',
    meaning: 'You removed them.',
  },
}
