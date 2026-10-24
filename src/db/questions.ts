import { db } from './index'

/**
 * Delete questions and every reference to them: their place in rounds and in games.
 * Buzz history for them is kept. One transaction, so a failure leaves all of it.
 */
export async function deleteQuestions(ids: string[]): Promise<void> {
  await db.transaction('rw', [db.questions, db.rounds, db.gameQuestions], async () => {
    await db.questions.bulkDelete(ids)
    const rs = await db.rounds.toArray()
    for (const r of rs) {
      if (ids.some(id => r.questionIds.includes(id))) {
        await db.rounds.update(r.id, {
          questionIds: r.questionIds.filter(id => !ids.includes(id)),
        })
      }
    }
    // gameQuestions has no questionId index
    await db.gameQuestions.filter(gq => ids.includes(gq.questionId)).delete()
  })
}
