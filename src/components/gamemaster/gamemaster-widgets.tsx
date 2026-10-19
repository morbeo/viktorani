import { useId } from 'react'
import { ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react'
import { ProgressTrack } from '@/components/ProgressTrack'
import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { BuzzList } from '@/components/buzzer/BuzzList'
import { GameLogPanel } from '@/components/gamemaster/GameLogPanel'
import { QrCodePanel } from '@/components/gamemaster/QrCodePanel'
import { PRESENCE } from '@/components/gamemaster/presence'
import { RoundInfo } from '@/components/gamemaster/RoundInfo'
import { HostQuestionPanel } from '@/components/host/HostQuestionPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import { TimerPanel } from '@/components/timer/TimerPanel'
import { Button, Icon } from '@/components/ui'
import { isConnected } from '@/pages/admin/gamemaster-utils'
import type { GamemasterData, WidgetProps } from '@/widgets/types'

/**
 * Widget adapters (registry `gamemaster` components): each renders an existing host panel
 * from the game master's {@link GamemasterData}. The buzzer and timers hide once the game
 * has ended, and the buzzer also when the game has none, whatever the layout says.
 */

type GamemasterWidgetProps = WidgetProps<GamemasterData>

const isEnded = (data: GamemasterData) => data.game.status === 'ended'

export function GamemasterRoundInfoWidget({ data }: GamemasterWidgetProps) {
  return <RoundInfo pos={data.pos} seq={data.seq} />
}

/** The progress track on its own, as in the header (#408). */
export function GamemasterProgressWidget({ data }: GamemasterWidgetProps) {
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-3">
      <ProgressTrack pos={data.pos} seq={data.seq} />
    </div>
  )
}

export function GamemasterQuestionWidget({ data }: GamemasterWidgetProps) {
  const { question, gameQuestion, game, onGameChange, players, teams, onRule } = data
  if (!question || !gameQuestion) return null
  return (
    <HostQuestionPanel
      question={question}
      gameQuestion={gameQuestion}
      game={game}
      onGameChange={onGameChange}
      ruling={{ players, teams, onRule }}
    />
  )
}

export function GamemasterBuzzerWidget({ data }: GamemasterWidgetProps) {
  const { game, questionId, buzzer } = data
  if (isEnded(data) || !game.buzzerEnabled) return null
  return (
    <BuzzerPanel
      game={game}
      questionId={questionId}
      buzzes={buzzer.buzzes}
      displayBuzzes={buzzer.displayBuzzes}
      onToggleLock={buzzer.onToggleLock}
      onAdjudicate={buzzer.onAdjudicate}
      onClear={buzzer.onClear}
    />
  )
}

/**
 * Just the buzz queue, in arrival order, with the judging buttons: for layouts that place
 * the lock and clear controls elsewhere or leave them out.
 */
export function GamemasterBuzzOrderWidget({ data }: GamemasterWidgetProps) {
  const { game, buzzer } = data
  if (isEnded(data) || !game.buzzerEnabled) return null
  return (
    <section aria-label="Buzz order">
      <BuzzList
        buzzes={buzzer.displayBuzzes}
        allBuzzes={buzzer.buzzes}
        onAdjudicate={buzzer.onAdjudicate}
        showAll={game.buzzDeduplication === 'all'}
      />
    </section>
  )
}

export function GamemasterTimerWidget({ data }: GamemasterWidgetProps) {
  if (isEnded(data)) return null
  return (
    <TimerPanel gameId={data.game.id} hook={data.timers} soundMuted={data.game.soundEffectsMuted} />
  )
}

export function GamemasterScoreboardWidget({ data }: GamemasterWidgetProps) {
  return <ScoreboardPanel game={data.game} questionId={data.questionId} />
}

export function GamemasterLogWidget({ data }: GamemasterWidgetProps) {
  return <GameLogPanel game={data.game} />
}

export function GamemasterQrCodeWidget({ data }: GamemasterWidgetProps) {
  return <QrCodePanel game={data.game} />
}

/**
 * Who is in the game, read-only: each player's presence, name and team. Players who left or
 * were kicked are left out; the People tab still lists them.
 */
export function GamemasterPlayerListWidget({ data }: GamemasterWidgetProps) {
  const players = data.players.filter(p => p.presence !== 'left' && p.presence !== 'kicked')
  const teams = new Map(data.teams.map(t => [t.id, t]))
  const connected = players.filter(p => p.presence === 'connected').length
  // A layout may place the widget more than once
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-(--color-border) bg-(--color-surface)"
    >
      <h2
        id={headingId}
        className="flex justify-between px-4 py-2 text-xs font-semibold uppercase text-(--color-muted)"
      >
        Players
        <span className="normal-case font-normal">
          Connected {connected}/{players.length}
        </span>
      </h2>
      {players.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-(--color-muted)">No players yet.</p>
      ) : (
        <ul>
          {players.map(player => {
            const presence = PRESENCE[player.presence]
            const team = player.teamId ? teams.get(player.teamId) : undefined
            return (
              <li
                key={player.id}
                className="flex items-center gap-2 border-t border-(--color-border) px-4 py-1.5 text-sm"
              >
                <span
                  role="img"
                  aria-label={presence.label}
                  title={presence.label}
                  className="shrink-0"
                  style={{ color: presence.color }}
                >
                  <Icon icon={presence.icon} size="sm" aria-hidden />
                </span>
                <span
                  className={`flex-1 truncate ${isConnected(player) ? 'text-(--color-text)' : 'text-(--color-muted)'}`}
                >
                  {player.name}
                </span>
                {team && (
                  <span className="flex items-center gap-1 truncate text-xs text-(--color-muted)">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: team.color }}
                      aria-hidden
                    />
                    {team.name}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * Large previous, next and buzzer lock buttons, for running the game from a touch screen.
 * Next asks before skipping unjudged buzzes, as the header's arrow does.
 */
export function GamemasterGameControlsWidget({ data }: GamemasterWidgetProps) {
  const { game, pos, nav, buzzer } = data
  if (isEnded(data)) return null
  return (
    <div
      role="group"
      aria-label="Game controls"
      className="grid auto-cols-fr grid-flow-col gap-3 [&>button]:w-full"
    >
      <Button size="lg" onClick={nav.onPrev} disabled={pos.isFirst}>
        <Icon icon={ChevronLeft} size="md" aria-hidden />
        Previous
      </Button>
      {game.buzzerEnabled && (
        <Button size="lg" onClick={buzzer.onToggleLock}>
          <Icon icon={game.buzzerLocked ? LockOpen : Lock} size="md" aria-hidden />
          {game.buzzerLocked ? 'Unlock buzzer' : 'Lock buzzer'}
        </Button>
      )}
      <Button size="lg" variant="primary" onClick={nav.onNext} disabled={pos.isLast}>
        Next
        <Icon icon={ChevronRight} size="md" aria-hidden />
      </Button>
    </div>
  )
}
