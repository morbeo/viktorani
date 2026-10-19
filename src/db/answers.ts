import { db } from '@/db'
import type { Answer, Game, GameQuestion, Question } from '@/db'
import { logEvent } from '@/db/game-log'
import { questionPoints } from '@/db/rulings'
import { broadcastScores, writeScore } from '@/hooks/useScoreboard'

/** True/false questions store no options of their own. */
const TRUE_FALSE_OPTIONS = ['True', 'False']

/** The options a player picks from: a true/false question's two, a multiple-choice one's own. */
export function choiceOptions(question: Pick<Question, 'type' | 'options'>): string[] {
  if (question.type === 'true_false') return TRUE_FALSE_OPTIONS
  if (question.type === 'multiple_choice') return question.options
  return []
}

/**
 * Record a player's choice for the question shown (ADR 0023). The host calls this with the
 * player it mapped the connection to and its own clock, never values from the payload.
 * Accepted only for a question of the same game that is still open (`pending`) and has an
 * option at `choice`. In a team game the answer is the team's: it replaces the one any
 * member sent before. Resolves to whether it was accepted.
 */
export async function recordAnswer(
  gameId: string,
  gameQuestionId: string,
  playerId: string,
  choice: number,
  receivedAt: number
): Promise<boolean> {
  return db.transaction(
    'rw',
    [db.answers, db.gameQuestions, db.questions, db.players, db.teams],
    async () => {
      const gq = await db.gameQuestions.get(gameQuestionId)
      if (!gq || gq.gameId !== gameId || gq.status !== 'pending') return false
      const question = await db.questions.get(gq.questionId)
      if (!question || !Number.isInteger(choice) || choice < 0) return false
      if (choice >= choiceOptions(question).length) return false
      const player = await db.players.get(playerId)
      if (player?.gameId !== gameId) return false
      const team = player.teamId ? await db.teams.get(player.teamId) : undefined
      const teamId = team?.gameId === gameId ? team.id : null

      const existing = await db.answers
        .where('gameQuestionId')
        .equals(gameQuestionId)
        .filter(a => (teamId ? a.teamId === teamId : a.teamId === null && a.playerId === playerId))
        .first()
      if (existing) {
        await db.answers.update(existing.id, { playerId, choice, receivedAt })
      } else {
        await db.answers.add({
          id: crypto.randomUUID(),
          gameId,
          gameQuestionId,
          playerId,
          teamId,
          choice,
          receivedAt,
          ruling: 'pending',
        })
      }
      return true
    }
  )
}

/** What marking a question's answers found. */
export interface MarkResult {
  correct: number
  total: number
}

/**
 * Mark the answers to a question against its correct answer (ADR 0023) and close it to new
 * ones. Each correct answer scores the question's points for its team, or for the player
 * when they're not on a team. Answers are marked once: running it again only marks answers
 * that arrived since. When any answer is marked, the question becomes `correct` if one was
 * right and `incorrect` otherwise. With nothing to mark, a still-open question becomes
 * `closeAs` when given, in the same transaction, so no answer slips in before the caller's
 * ruling or move lands. Resolves to `null` when there was nothing to mark.
 */
export async function markAnswers(
  game: Pick<Game, 'id' | 'scoringEnabled'>,
  gameQuestionId: string,
  closeAs?: Exclude<GameQuestion['status'], 'pending'>
): Promise<MarkResult | null> {
  const result = await db.transaction(
    'rw',
    [
      db.answers,
      db.gameQuestions,
      db.questions,
      db.difficulties,
      db.players,
      db.teams,
      db.scoreEvents,
    ],
    async () => {
      const gq = await db.gameQuestions.get(gameQuestionId)
      if (!gq || gq.gameId !== game.id) return null
      const pending = await db.answers
        .where('gameQuestionId')
        .equals(gameQuestionId)
        .filter((a: Answer) => a.ruling === 'pending')
        .toArray()
      if (pending.length === 0) {
        if (closeAs && gq.status === 'pending') {
          await db.gameQuestions.update(gameQuestionId, { status: closeAs })
        }
        return null
      }

      const question = await db.questions.get(gq.questionId)
      const options = question ? choiceOptions(question) : []
      const isRight = (a: Answer) => question !== undefined && options[a.choice] === question.answer
      const points = await questionPoints(gq.questionId)
      let correct = 0
      let scored = false
      for (const a of pending) {
        const right = isRight(a)
        await db.answers.update(a.id, { ruling: right ? 'correct' : 'incorrect' })
        if (!right) continue
        correct++
        if (!game.scoringEnabled) continue
        const award = a.teamId
          ? { kind: 'team' as const, id: a.teamId }
          : { kind: 'player' as const, id: a.playerId }
        scored =
          (await writeScore({
            ...award,
            gameId: game.id,
            next: (score: number) => score + points,
            reason: 'correct',
            questionId: gq.questionId,
          })) || scored
      }
      if (gq.status !== 'correct') {
        await db.gameQuestions.update(gameQuestionId, {
          status: correct > 0 ? 'correct' : 'incorrect',
        })
      }
      return { questionId: gq.questionId, correct, total: pending.length, scored }
    }
  )
  if (!result) return null
  logEvent(game.id, 'answers_marked', {
    subjectId: result.questionId,
    data: { correct: result.correct, total: result.total },
  })
  if (result.scored) await broadcastScores(game.id)
  return { correct: result.correct, total: result.total }
}
