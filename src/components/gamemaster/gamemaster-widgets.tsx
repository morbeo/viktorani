import { BuzzerPanel } from '@/components/buzzer/BuzzerPanel'
import { GameLogPanel } from '@/components/gamemaster/GameLogPanel'
import { QrCodePanel } from '@/components/gamemaster/QrCodePanel'
import { RoundInfo } from '@/components/gamemaster/RoundInfo'
import { HostQuestionPanel } from '@/components/host/HostQuestionPanel'
import { ScoreboardPanel } from '@/components/scoreboard/ScoreboardPanel'
import { TimerPanel } from '@/components/timer/TimerPanel'
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

export function GamemasterQuestionWidget({ data }: GamemasterWidgetProps) {
  const { question, gameQuestion, game, onGameChange } = data
  if (!question || !gameQuestion) return null
  return (
    <HostQuestionPanel
      question={question}
      gameQuestion={gameQuestion}
      game={game}
      onGameChange={onGameChange}
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
