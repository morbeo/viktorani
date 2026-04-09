import type { Question, GameQuestion, Game } from '@/db'
import { HostQuestionHeader } from './HostQuestionHeader'
import { HostQuestionAnswers } from './HostQuestionAnswers'
import { HostQuestionMedia } from './HostQuestionMedia'
import { HostVisibilityToggles } from './HostVisibilityToggles'

interface HostQuestionPanelProps {
  question: Question
  gameQuestion: GameQuestion
  game: Game
}

export function HostQuestionPanel({ question, gameQuestion, game }: HostQuestionPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <HostQuestionHeader question={question} gameQuestion={gameQuestion} />
      <HostQuestionAnswers question={question} />
      {question.media && question.mediaType && <HostQuestionMedia question={question} />}
      <HostVisibilityToggles game={game} />
    </div>
  )
}
