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

/** What a timer is for: one question, one round or the whole game (#421). */
export type TimerScope = 'question' | 'round' | 'game'

/**
 * Shortcuts for a new timer. Each fills in a label and the auto-reset that matches its
 * lifetime: a question timer resets on every question change, a round timer on every round
 * change, and a game timer never resets.
 */
export const TIMER_SCOPES: { value: TimerScope; label: string; autoReset: TimerAutoReset }[] = [
  { value: 'question', label: 'This question', autoReset: 'question' },
  { value: 'round', label: 'This round', autoReset: 'round' },
  { value: 'game', label: 'Whole game', autoReset: 'none' },
]

/** The label a scoped timer gets when the host leaves it blank. */
export const SCOPE_TIMER_LABELS: Record<TimerScope, string> = {
  question: 'Question',
  round: 'Round',
  game: 'Game',
}
