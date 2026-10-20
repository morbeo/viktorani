import type { GameEvent } from '@/transport/types'
import type { SentAnswer } from './OpenQuestions'

/** What the host last said about the player's team's answers (see `TEAM_ANSWERS`). */
export type TeamAnswers = Omit<Extract<GameEvent, { type: 'TEAM_ANSWERS' }>, 'type'>

/** How a phone shows one question's answer pad in a team game. */
export interface TeamAnswerView {
  /** Whether this player may answer now. */
  canAnswer: boolean
  /** The answer to show as picked or sent: the team's, else this phone's own. */
  choice: number | null
  text: string | null
  /** Who decides the team's answer, when it isn't simply this player; else `null`. */
  note: string | null
}

const describe = (a: { choice: number | null; text: string | null }) =>
  a.choice !== null ? String.fromCharCode(65 + a.choice) : `"${a.text ?? ''}"`

/**
 * How the answer pad for `questionId` looks on this player's phone, given the team's
 * answering mode and current answers. Outside a team game it is this phone's own answer.
 * With `captain`, only the captain answers; with `firstReply`, a teammate's first answer
 * holds. The team's answer from another member wins over this phone's, so every member sees
 * the same. Pure function.
 */
export function teamAnswerView(
  team: TeamAnswers | null,
  questionId: string,
  playerId: string | null,
  mine: SentAnswer | undefined
): TeamAnswerView {
  const own = {
    choice: mine && 'choice' in mine ? mine.choice : null,
    text: mine && 'text' in mine ? mine.text : null,
  }
  if (!team) return { canAnswer: true, ...own, note: null }
  const current = team.answers.find(a => a.questionId === questionId)
  const byOther = current && current.playerId !== playerId ? current : undefined
  const shown = byOther ? { choice: byOther.choice, text: byOther.text } : mine ? own : current
  const answer = shown ?? { choice: null, text: null }
  const said = byOther ? ` Team answer: ${describe(byOther)}, from ${byOther.playerName}.` : ''

  if (team.mode === 'captain' && team.captainId !== playerId) {
    const who = team.captainName ?? 'Your captain'
    return { canAnswer: false, ...answer, note: `${who} answers for your team.${said}` }
  }
  if (team.mode === 'firstReply' && byOther) {
    return {
      canAnswer: false,
      ...answer,
      note: `${byOther.playerName} answered first for your team: ${describe(byOther)}.`,
    }
  }
  if (team.mode === 'captain') {
    return { canAnswer: true, ...answer, note: 'You answer for your team.' }
  }
  return { canAnswer: true, ...answer, note: said ? said.trim() : null }
}
