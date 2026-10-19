import type { Question, GameQuestion, Game } from '@/db'
import { HostQuestionHeader } from './HostQuestionHeader'
import { HostQuestionAnswers } from './HostQuestionAnswers'
import { HostQuestionMedia } from './HostQuestionMedia'
import { HostVisibilityToggles } from './HostVisibilityToggles'
import { HostRulingPanel } from './HostRulingPanel'
import type { Player, Team } from '@/db'
import type { QuestionRuling, RulingAward } from '@/db/rulings'

interface HostQuestionPanelProps {
  question: Question
  gameQuestion: GameQuestion
  game: Game
  /** Receives each saved visibility patch; the caller merges it into its current game. */
  onGameChange?: (patch: Partial<Game>) => void
  /** Who can be awarded a correct ruling, and where rulings go; no ruling controls without it. */
  ruling?: {
    players: Player[]
    teams: Team[]
    onRule: (ruling: QuestionRuling, award: RulingAward | null) => void
  }
}

export function HostQuestionPanel({
  question,
  gameQuestion,
  game,
  onGameChange,
  ruling,
}: HostQuestionPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <HostQuestionHeader question={question} gameQuestion={gameQuestion} />
      <HostQuestionAnswers question={question} />
      {ruling && (
        <HostRulingPanel
          // A fresh choice of who gets the points for each question
          key={gameQuestion.id}
          status={gameQuestion.status}
          scoringEnabled={game.scoringEnabled}
          players={ruling.players}
          teams={ruling.teams}
          disabled={game.status === 'ended'}
          onRule={ruling.onRule}
        />
      )}
      {question.media && question.mediaType && <HostQuestionMedia question={question} />}
      <HostVisibilityToggles game={game} onGameChange={onGameChange} />
    </div>
  )
}
