import { db } from '@/db'
import type { Game, GameQuestion } from '@/db'
import { logEvent } from '@/db/game-log'
import { broadcastScores, writeScore } from '@/hooks/useScoreboard'

/** The host's ruling on a whole question, made without a buzz. */
export type QuestionRuling = Exclude<GameQuestion['status'], 'pending'>

/** Who a correct ruling awards the question's points to. */
export interface RulingAward {
  kind: 'player' | 'team'
  id: string
}

/** Points a correct answer to `questionId` is worth: its difficulty's score, or 1. */
export async function questionPoints(questionId: string | null): Promise<number> {
  const question = questionId ? await db.questions.get(questionId) : undefined
  if (!question?.difficulty) return 1
  return (await db.difficulties.get(question.difficulty))?.score ?? 1
}

/**
 * Show the correct answer of a question to players and screens (ADR 0023). Does nothing for
 * another game's question or one already revealed. Resolves to whether it was revealed now.
 */
export async function revealQuestion(gameId: string, gameQuestionId: string): Promise<boolean> {
  const gq = await db.transaction('rw', db.gameQuestions, async () => {
    const row = await db.gameQuestions.get(gameQuestionId)
    if (!row || row.gameId !== gameId || row.revealed) return null
    await db.gameQuestions.update(gameQuestionId, { revealed: true })
    return row
  })
  if (!gq) return false
  logEvent(gameId, 'answer_revealed', { subjectId: gq.questionId })
  return true
}

/**
 * Whether `gameId` already has a correct-answer score for `questionId`, from a ruling or a
 * buzz. A question's points are awarded once, whichever way it was ruled.
 */
export async function alreadyAwarded(gameId: string, questionId: string): Promise<boolean> {
  const event = await db.scoreEvents
    .where('gameId')
    .equals(gameId)
    .filter(e => e.reason === 'correct' && e.questionId === questionId)
    .first()
  return event !== undefined
}

/**
 * Rule on the question shown without a buzz (#424): set its status and, for a correct
 * ruling with scoring on, award its points to `award`. A player's points count for their
 * team too, as with a buzz. A question's points are awarded once: when this game already
 * has a correct-answer score for it (from a ruling or a buzz), ruling it correct again only
 * sets the status. Ruling again never takes points back either; the host adjusts those on
 * the scoreboard. Nothing is sent to players about the answer.
 */
export async function ruleQuestion(
  game: Pick<Game, 'id' | 'scoringEnabled'>,
  gameQuestionId: string,
  ruling: QuestionRuling,
  award: RulingAward | null = null
): Promise<void> {
  const result = await db.transaction(
    'rw',
    [db.gameQuestions, db.questions, db.difficulties, db.players, db.teams, db.scoreEvents],
    async (): Promise<{ questionId: string; name: string; scored: boolean } | null> => {
      const gq = await db.gameQuestions.get(gameQuestionId)
      if (!gq || gq.gameId !== game.id) return null
      await db.gameQuestions.update(gameQuestionId, { status: ruling })
      const done = { questionId: gq.questionId, name: '', scored: false }
      if (ruling !== 'correct' || !award) return done

      const row =
        award.kind === 'team' ? await db.teams.get(award.id) : await db.players.get(award.id)
      if (row?.gameId !== game.id) return done
      if (!game.scoringEnabled) return { ...done, name: row.name }
      if (await alreadyAwarded(game.id, gq.questionId)) return { ...done, name: row.name }

      const points = await questionPoints(gq.questionId)
      const change = {
        gameId: game.id,
        next: (score: number) => score + points,
        reason: 'correct' as const,
        questionId: gq.questionId,
      }
      const scored = await writeScore({ ...change, ...award })
      const teamId = 'teamId' in row ? row.teamId : null
      if (teamId && (await db.teams.get(teamId))?.gameId === game.id) {
        await writeScore({ ...change, kind: 'team', id: teamId })
      }
      return { ...done, name: row.name, scored }
    }
  )
  if (!result) return
  logEvent(game.id, 'question_ruled', {
    subjectId: result.questionId,
    data: { status: ruling, ...(result.name && { name: result.name }) },
  })
  if (result.scored) await broadcastScores(game.id)
}
