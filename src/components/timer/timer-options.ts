import type { TimerNotify, TimerAutoReset } from '@/hooks/useTimer'

/** Choices for a timer's notifications and auto-reset, shared by the timer modal and settings. */
export const AUDIO_OPTIONS: { value: TimerNotify; label: string; description: string }[] = [
  { value: 'none', label: 'Off', description: 'No sound' },
  { value: 'host', label: 'Host only', description: 'Beep on GM screen' },
  { value: 'players', label: 'Players', description: 'Beep on player screens' },
  { value: 'both', label: 'Everyone', description: 'GM + all players' },
]

export const VISUAL_OPTIONS: { value: TimerNotify; label: string; description: string }[] = [
  { value: 'none', label: 'Off', description: 'No popup' },
  { value: 'host', label: 'Host only', description: 'Popup on GM screen' },
  { value: 'players', label: 'Players', description: 'Popup on player screens' },
  { value: 'both', label: 'Everyone', description: 'GM + all players' },
]

export const RESET_OPTIONS: { value: TimerAutoReset; label: string; description: string }[] = [
  { value: 'none', label: 'Manual', description: 'Never auto-reset' },
  { value: 'question', label: 'Per question', description: 'Reset on question change' },
  { value: 'round', label: 'Per round', description: 'Reset on round change' },
  { value: 'any', label: 'Any nav', description: 'Reset on any slide change' },
]
