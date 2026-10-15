import { PlayerTimers } from '@/components/timer/PlayerTimers'
import type { PlayerData, WidgetProps } from '@/widgets/types'
import { AnnouncementBanner } from './AnnouncementBanner'
import { PlayerQuestion } from './PlayerQuestion'

/**
 * Widget adapters (registry `player` components): each renders a piece of the player's
 * screen from {@link PlayerData}. The question, buzz button and timers hide once the game
 * has ended, whatever the layout says.
 */

type PlayerWidgetProps = WidgetProps<PlayerData>

/** The big round buzz button; `label` says why it's disabled when it is. */
export function BuzzButton({ enabled, label, onBuzz }: NonNullable<PlayerData['buzzer']>) {
  return (
    <button
      type="button"
      aria-label="Buzz"
      disabled={!enabled}
      onClick={onBuzz}
      className="w-64 h-64 rounded-full text-4xl font-black shadow-lg transition-colors"
      style={{
        background: enabled ? 'var(--color-red)' : 'var(--color-border)',
        color: enabled ? '#fff' : 'var(--color-muted)',
      }}
    >
      {label}
    </button>
  )
}

export function PlayerAnnouncementWidget({ data }: PlayerWidgetProps) {
  return <AnnouncementBanner message={data.message} />
}

export function PlayerQuestionWidget({ data }: PlayerWidgetProps) {
  if (data.ended || !data.question) return null
  return <PlayerQuestion question={data.question} />
}

export function PlayerBuzzerWidget({ data }: PlayerWidgetProps) {
  if (data.ended || !data.buzzer) return null
  return <BuzzButton {...data.buzzer} />
}

export function PlayerTimerWidget({ data }: PlayerWidgetProps) {
  if (data.ended) return null
  return <PlayerTimers />
}
