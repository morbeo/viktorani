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
        background: enabled ? 'var(--color-negative)' : 'var(--color-border)',
        color: enabled ? '#fff' : 'var(--color-muted)',
      }}
    >
      {label}
    </button>
  )
}

const letter = (i: number) => String.fromCharCode(65 + i)

/**
 * The options a player picks from, by letter, with their text when the host shows it.
 * Once the host stops taking answers, only the player's own pick is left.
 */
export function ChoicePad({
  count,
  options,
  selected,
  enabled,
  onChoose,
}: NonNullable<PlayerData['choice']>) {
  if (count === null) {
    if (selected === null) return null
    return (
      <p role="status" className="text-sm text-muted">
        Your answer: {letter(selected)}
        {options?.[selected] ? ` · ${options[selected]}` : ''}
      </p>
    )
  }
  return (
    <section aria-label="Your answer" className="w-full max-w-sm flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={options?.[i] ? `${letter(i)} ${options[i]}` : letter(i)}
            aria-pressed={selected === i}
            disabled={!enabled}
            onClick={() => onChoose(i)}
            className={`min-h-16 rounded-xl border-2 px-3 py-2 text-left font-semibold text-text ${selected === i ? 'border-accent bg-surface' : 'border-border'}`}
          >
            <span className="mono mr-2 text-muted">{letter(i)}</span>
            {options?.[i]}
          </button>
        ))}
      </div>
      <p role="status" className="text-xs text-muted">
        {selected === null
          ? 'Pick an answer.'
          : `Answer ${letter(selected)} sent. You can change it until the host marks answers.`}
      </p>
    </section>
  )
}

export function PlayerAnnouncementWidget({ data }: PlayerWidgetProps) {
  return <AnnouncementBanner message={data.message} />
}

export function PlayerQuestionWidget({ data }: PlayerWidgetProps) {
  if (data.ended || !data.question) return null
  return <PlayerQuestion question={data.question} />
}

/** How the player answers: the options to pick from in a choice game, else the buzz button. */
export function PlayerBuzzerWidget({ data }: PlayerWidgetProps) {
  if (data.ended) return null
  if (data.choice) return <ChoicePad {...data.choice} />
  if (!data.buzzer) return null
  return <BuzzButton {...data.buzzer} />
}

export function PlayerTimerWidget({ data }: PlayerWidgetProps) {
  if (data.ended) return null
  return <PlayerTimers />
}
