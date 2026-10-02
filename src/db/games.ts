import { db } from './index'
import type { Game, GameQuestion, GmDecision, Round } from './index'
import { generateRoomId } from '@/transport'

/**
 * Game create / clone / delete. Each runs in a single transaction so a failure
 * part-way never leaves a game without its questions or orphaned child rows.
 */

/** Materialise a game's questions from its rounds, numbered across all rounds. */
export function buildGameQuestions(
  gameId: string,
  roundIds: string[],
  rounds: Round[]
): GameQuestion[] {
  let order = 0
  return roundIds.flatMap(roundId => {
    const round = rounds.find(r => r.id === roundId)
    if (!round) return []
    return round.questionIds.map(questionId => ({
      id: crypto.randomUUID(),
      gameId,
      questionId,
      roundId,
      order: order++,
      status: 'pending' as const,
    }))
  })
}

export async function createGame(game: Game, rounds: Round[]): Promise<void> {
  const gqs = buildGameQuestions(game.id, game.roundIds, rounds)
  await db.transaction('rw', [db.games, db.gameQuestions], async () => {
    await db.games.add(game)
    await db.gameQuestions.bulkAdd(gqs)
  })
}

/** Copy a game's settings and questions into a fresh, unplayed game. */
export async function cloneGame(game: Game): Promise<string> {
  const now = Date.now()
  const newId = crypto.randomUUID()
  const clone: Game = {
    ...game,
    id: newId,
    name: `${game.name} (copy)`,
    status: 'waiting',
    roomId: generateRoomId(),
    currentRoundIdx: 0,
    currentQuestionIdx: 0,
    buzzerLocked: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.transaction('rw', [db.games, db.gameQuestions], async () => {
    const gqs = await db.gameQuestions.where('gameId').equals(game.id).toArray()
    await db.games.add(clone)
    await db.gameQuestions.bulkAdd(
      gqs.map(gq => ({ ...gq, id: crypto.randomUUID(), gameId: newId, status: 'pending' as const }))
    )
  })
  return newId
}

/** Delete a game and every row that belongs to it. */
export async function deleteGame(gameId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.games,
      db.gameQuestions,
      db.teams,
      db.players,
      db.buzzEvents,
      db.scoreEvents,
      db.timers,
      db.layouts,
      db.widgets,
    ],
    async () => {
      const layoutIds = await db.layouts.where('gameId').equals(gameId).primaryKeys()
      await db.widgets.where('layoutId').anyOf(layoutIds).delete()
      await db.layouts.where('gameId').equals(gameId).delete()
      await db.gameQuestions.where('gameId').equals(gameId).delete()
      await db.teams.where('gameId').equals(gameId).delete()
      await db.players.where('gameId').equals(gameId).delete()
      await db.buzzEvents.where('gameId').equals(gameId).delete()
      await db.scoreEvents.where('gameId').equals(gameId).delete()
      await db.timers.where('gameId').equals(gameId).delete()
      await db.games.delete(gameId)
    }
  )
}

/**
 * A game question's status after the GM rules on a buzz, or after the GM moves on
 * (`'left'`). A correct answer stands, skipping a buzz changes nothing, and moving on
 * from a question nobody answered marks it skipped.
 */
export function nextQuestionStatus(
  current: GameQuestion['status'],
  event: GmDecision | 'left'
): GameQuestion['status'] {
  if (event === 'Correct') return 'correct'
  if (event === 'Incorrect') return current === 'correct' ? 'correct' : 'incorrect'
  if (event === 'left') return current === 'pending' ? 'skipped' : current
  return current
}

/** Record a ruling or the GM moving on against a game question (see {@link nextQuestionStatus}). */
export async function updateQuestionStatus(
  gameQuestionId: string,
  event: GmDecision | 'left'
): Promise<void> {
  await db.transaction('rw', db.gameQuestions, async () => {
    const gq = await db.gameQuestions.get(gameQuestionId)
    if (!gq) return
    const status = nextQuestionStatus(gq.status, event)
    if (status !== gq.status) await db.gameQuestions.update(gameQuestionId, { status })
  })
}
