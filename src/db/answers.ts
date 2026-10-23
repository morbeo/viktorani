import { db, MAX_ANSWER_TEXT_LENGTH } from '@/db'
import type { Answer, Game, GameQuestion, Player, Question, Team, Vote } from '@/db'
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
 * How players answer a question on their phones: by picking an option in a `choice` game,
 * or by typing in a `text` game. A question with no options to pick from (open-ended) takes
 * typed answers in a `choice` game too. `null` when the game takes no answers on phones.
 */
export function answerKind(
  inputType: Game['inputType'],
  question: Pick<Question, 'type' | 'options'>
): 'choice' | 'text' | null {
  if (inputType === 'text') return 'text'
  if (inputType === 'choice') return choiceOptions(question).length > 0 ? 'choice' : 'text'
  return null
}

/**
 * Whether the game keeps players' answers open until the end of the round
 * ({@link Game.answersClose}): only in a game that takes answers on phones.
 */
export function keepsAnswersOpen(game: Pick<Game, 'inputType' | 'answersClose'>): boolean {
  return (
    game.answersClose === 'endOfRound' && (game.inputType === 'choice' || game.inputType === 'text')
  )
}

/** Whether a player is on the team and hasn't left or been removed. */
function isActiveMember(p: Pick<Player, 'teamId' | 'presence'>, teamId: string): boolean {
  return p.teamId === teamId && p.presence !== 'left' && p.presence !== 'kicked'
}

/**
 * The member who answers for a team when only captains answer ({@link Game.teamAnswering}):
 * the host's chosen captain while still on the team, else the member who joined first.
 * Members who left or were removed don't count. `null` when the team has nobody. Pure function.
 */
export function teamCaptain(
  team: Pick<Team, 'id' | 'captainId'>,
  players: ReadonlyArray<Pick<Player, 'id' | 'teamId' | 'joinedAt' | 'presence'>>
): string | null {
  const members = players
    .filter(p => isActiveMember(p, team.id))
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
  if (team.captainId && members.some(p => p.id === team.captainId)) return team.captainId
  return members[0]?.id ?? null
}

/** What a player sends: an option's index in a `choice` game, typed text in a `text` game. */
export type AnswerInput = { choice: number } | { text: string }

/** A typed answer as stored and compared: trimmed, with runs of whitespace made one space. */
export function normaliseAnswerText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** Whether a typed answer matches the correct one, ignoring case and spacing. */
export function textMatches(text: string, answer: string): boolean {
  const a = normaliseAnswerText(answer)
  return a !== '' && normaliseAnswerText(text).toLocaleLowerCase() === a.toLocaleLowerCase()
}

/** One answer's share of a team's votes, as {@link tallyVotes} counts them. */
export interface VoteTally {
  choice: number | null
  /** As the first member to vote for it typed it. */
  text: string | null
  count: number
  /** The first member to vote for it, and when. */
  playerId: string
  at: number
}

/** How votes and answers are grouped: by option, or by text ignoring case and spacing. */
function answerKey(a: Pick<Vote, 'choice' | 'text'>): string {
  return a.choice !== null
    ? `c${a.choice}`
    : `t${normaliseAnswerText(a.text ?? '').toLocaleLowerCase()}`
}

/** Whether two answers count as the same vote. */
function sameAnswer(a: Pick<Vote, 'choice' | 'text'>, b: Pick<Vote, 'choice' | 'text'>): boolean {
  return answerKey(a) === answerKey(b)
}

/**
 * Count a team's votes by answer, most votes first; a tie goes to the answer voted for
 * first. Typed answers count as the same when they match ignoring case and spacing.
 * Pure function.
 */
export function tallyVotes(votes: ReadonlyArray<Vote>): VoteTally[] {
  const tallies = new Map<string, VoteTally>()
  for (const v of [...votes].sort((a, b) => a.at - b.at)) {
    const key = answerKey(v)
    const tally = tallies.get(key)
    if (tally) tally.count++
    else
      tallies.set(key, { choice: v.choice, text: v.text, count: 1, playerId: v.playerId, at: v.at })
  }
  return [...tallies.values()].sort((a, b) => b.count - a.count || a.at - b.at)
}

/** The tables a change to an answer's ruling writes, for the transactions that make one. */
const RULING_TABLES = [
  db.answers,
  db.gameQuestions,
  db.questions,
  db.difficulties,
  db.players,
  db.teams,
  db.scoreEvents,
]

/**
 * Give an answer a new ruling and move its points to match: a correct one scores the
 * question's points for its team (or player), and one no longer correct takes them back.
 * Call inside a transaction over {@link RULING_TABLES}. Resolves to whether a score changed.
 */
async function setRuling(
  game: Pick<Game, 'id' | 'scoringEnabled'>,
  answer: Answer,
  ruling: Answer['ruling'],
  gq: GameQuestion,
  points: number
): Promise<boolean> {
  if (answer.ruling === ruling) return false
  await db.answers.update(answer.id, { ruling })
  const delta = ruling === 'correct' ? points : answer.ruling === 'correct' ? -points : 0
  if (delta === 0 || !game.scoringEnabled) return false
  return writeScore({
    ...(answer.teamId
      ? { kind: 'team' as const, id: answer.teamId }
      : { kind: 'player' as const, id: answer.playerId }),
    gameId: game.id,
    next: (score: number) => score + delta,
    reason: delta > 0 ? 'correct' : 'retract',
    questionId: gq.questionId,
    gameQuestionId: gq.id,
  })
}

/**
 * Set a team's answer from its votes: the leading one ({@link tallyVotes}), keeping the mark
 * while it stays the same and putting it back to unmarked when it changes. With no votes
 * left the answer is removed. Call inside a transaction over {@link RULING_TABLES}.
 */
async function applyVotes(
  game: Pick<Game, 'id' | 'scoringEnabled'>,
  gq: GameQuestion,
  answer: Answer,
  votes: Vote[],
  receivedAt: number
): Promise<void> {
  const [top] = tallyVotes(votes)
  if (top && sameAnswer(answer, top)) {
    await db.answers.update(answer.id, { votes })
    return
  }
  await setRuling(game, answer, 'pending', gq, await questionPoints(gq.questionId))
  if (!top) {
    await db.answers.delete(answer.id)
    return
  }
  await db.answers.update(answer.id, {
    playerId: top.playerId,
    choice: top.choice,
    text: top.text,
    receivedAt,
    votes,
  })
}

/**
 * The team answers whose votes include someone no longer on the team, so the host can
 * {@link recountVotes} them. Pure function.
 */
export function staleVotes(
  answers: ReadonlyArray<Pick<Answer, 'id' | 'teamId' | 'votes'>>,
  players: ReadonlyArray<Pick<Player, 'id' | 'teamId' | 'presence'>>
): string[] {
  return answers
    .filter(a => {
      const teamId = a.teamId
      return (
        teamId &&
        a.votes?.some(v => !players.some(p => p.id === v.playerId && isActiveMember(p, teamId)))
      )
    })
    .map(a => a.id)
}

/**
 * Drop the votes of members no longer on the team from a team answer to a question still
 * open, in a game where teams vote, and set the answer from the votes left. Resolves to
 * whether it changed.
 */
export async function recountVotes(
  gameId: string,
  answerId: string,
  receivedAt: number
): Promise<boolean> {
  return db.transaction('rw', [db.games, ...RULING_TABLES], async () => {
    const game = await db.games.get(gameId)
    const answer = await db.answers.get(answerId)
    if (game?.teamAnswering !== 'vote' || answer?.gameId !== gameId) return false
    const { teamId, votes = [] } = answer
    const gq = await db.gameQuestions.get(answer.gameQuestionId)
    if (!teamId || !gq || gq.status !== 'pending' || gq.revealed) return false
    const members = await db.players.where('teamId').equals(teamId).toArray()
    const kept = votes.filter(v =>
      members.some(m => m.id === v.playerId && isActiveMember(m, teamId))
    )
    if (kept.length === votes.length) return false
    await applyVotes(game, gq, answer, kept, receivedAt)
    return true
  })
}

/**
 * Record a player's answer to the question shown (ADR 0023). The host calls this with the
 * player it mapped the connection to and its own clock, never values from the payload.
 * Accepted only for a question of the same game that is still open (`pending`) and whose
 * answer hasn't been revealed, in a game
 * that takes this kind of answer ({@link answerKind}): a choice the question has an option for, or text of 1 to
 * {@link MAX_ANSWER_TEXT_LENGTH} characters once trimmed. In a team game the answer is the
 * team's: it replaces the one any member sent before, and goes back to unmarked (taking back
 * any points it had scored). How the team decides it follows {@link Game.teamAnswering}: with
 * `firstReply` only the member who answered first may change it (anyone, once they are off
 * the team), with `captain` only the
 * team's captain ({@link teamCaptain}) answers, and with `vote` the answer is a vote: the
 * team's answer becomes the one with the most votes from members still on the team
 * ({@link tallyVotes}), and goes back to unmarked only when that changes. Resolves to whether
 * it was accepted.
 */
export async function recordAnswer(
  gameId: string,
  gameQuestionId: string,
  playerId: string,
  input: AnswerInput,
  receivedAt: number
): Promise<boolean> {
  return db.transaction('rw', [db.games, ...RULING_TABLES], async () => {
    const game = await db.games.get(gameId)
    const gq = await db.gameQuestions.get(gameQuestionId)
    if (!game || !gq || gq.gameId !== gameId || gq.status !== 'pending' || gq.revealed) return false
    const question = await db.questions.get(gq.questionId)
    if (!question) return false

    let choice: number | null = null
    let text: string | null = null
    const kind = answerKind(game.inputType, question)
    if ('choice' in input) {
      if (kind !== 'choice') return false
      if (!Number.isInteger(input.choice) || input.choice < 0) return false
      if (input.choice >= choiceOptions(question).length) return false
      choice = input.choice
    } else {
      if (kind !== 'text' || typeof input.text !== 'string') return false
      text = normaliseAnswerText(input.text)
      if (text === '' || text.length > MAX_ANSWER_TEXT_LENGTH) return false
    }

    const player = await db.players.get(playerId)
    if (player?.gameId !== gameId) return false
    const team = player.teamId ? await db.teams.get(player.teamId) : undefined
    const teamId = team?.gameId === gameId ? team.id : null
    if (team && teamId && game.teamAnswering === 'captain') {
      const members = await db.players.where('teamId').equals(teamId).toArray()
      if (teamCaptain(team, members) !== playerId) return false
    }

    const existing = await db.answers
      .where('gameQuestionId')
      .equals(gameQuestionId)
      .filter(a => (teamId ? a.teamId === teamId : a.teamId === null && a.playerId === playerId))
      .first()
    // The first reply holds while whoever sent it is still on the team
    if (
      existing &&
      teamId &&
      game.teamAnswering === 'firstReply' &&
      existing.playerId !== playerId
    ) {
      const holder = await db.players.get(existing.playerId)
      if (holder && isActiveMember(holder, teamId)) return false
    }
    if (teamId && game.teamAnswering === 'vote') {
      const members = await db.players.where('teamId').equals(teamId).toArray()
      const counts = (v: Vote) =>
        v.playerId !== playerId &&
        members.some(m => m.id === v.playerId && isActiveMember(m, teamId))
      const votes = [
        ...(existing?.votes ?? []).filter(counts),
        { playerId, choice, text, at: receivedAt },
      ]
      if (existing) {
        await applyVotes(game, gq, existing, votes, receivedAt)
      } else {
        const [top] = tallyVotes(votes)
        await db.answers.add({
          id: crypto.randomUUID(),
          gameId,
          gameQuestionId,
          playerId: top.playerId,
          teamId,
          choice: top.choice,
          text: top.text,
          receivedAt,
          ruling: 'pending',
          votes,
        })
      }
      return true
    }
    if (existing) {
      await setRuling(game, existing, 'pending', gq, await questionPoints(gq.questionId))
      await db.answers.update(existing.id, { playerId, choice, text, receivedAt })
    } else {
      await db.answers.add({
        id: crypto.randomUUID(),
        gameId,
        gameQuestionId,
        playerId,
        teamId,
        choice,
        text,
        receivedAt,
        ruling: 'pending',
      })
    }
    return true
  })
}

/** What marking a question's answers found. */
export interface MarkResult {
  /** Choices marked now, and how many of them were right. */
  correct: number
  total: number
  /** The question's status afterwards. */
  status: GameQuestion['status']
}

/**
 * Close a question to new answers (ADR 0023): mark its unmarked choices against the correct
 * answer, scoring each right one for its team (or player), and set its status from all its
 * answers: `correct` when any is right, `incorrect` otherwise. Typed answers stay as the host
 * marked them, and unmarked ones wait for the host. Choices are marked once: running it again
 * only marks choices that arrived since. A question nobody answered becomes `closeAs` when
 * given, in the same transaction, so no answer slips in before the caller's ruling or move
 * lands. Resolves to `null` when nothing changed.
 */
export async function markAnswers(
  game: Pick<Game, 'id' | 'scoringEnabled'>,
  gameQuestionId: string,
  closeAs?: Exclude<GameQuestion['status'], 'pending'>
): Promise<MarkResult | null> {
  const result = await db.transaction('rw', RULING_TABLES, async () => {
    const gq = await db.gameQuestions.get(gameQuestionId)
    if (!gq || gq.gameId !== game.id) return null
    const answers = await db.answers.where('gameQuestionId').equals(gameQuestionId).toArray()
    if (answers.length === 0) {
      if (closeAs && gq.status === 'pending') {
        await db.gameQuestions.update(gameQuestionId, { status: closeAs })
      }
      return null
    }

    const question = await db.questions.get(gq.questionId)
    const options = question ? choiceOptions(question) : []
    const points = await questionPoints(gq.questionId)
    const choices = answers.filter(a => a.choice !== null && a.ruling === 'pending')
    let correct = 0
    let scored = false
    for (const a of choices) {
      const right = question !== undefined && options[a.choice ?? -1] === question.answer
      if (right) correct++
      scored = (await setRuling(game, a, right ? 'correct' : 'incorrect', gq, points)) || scored
      a.ruling = right ? 'correct' : 'incorrect'
    }
    if (choices.length === 0 && gq.status !== 'pending') return null

    const status: GameQuestion['status'] = answers.some(a => a.ruling === 'correct')
      ? 'correct'
      : 'incorrect'
    if (gq.status !== 'correct') await db.gameQuestions.update(gameQuestionId, { status })
    return {
      questionId: gq.questionId,
      correct,
      total: choices.length,
      status: gq.status === 'correct' ? gq.status : status,
      scored,
    }
  })
  if (!result) return null
  if (result.total > 0) {
    logEvent(game.id, 'answers_marked', {
      subjectId: result.questionId,
      data: { correct: result.correct, total: result.total },
    })
  }
  if (result.scored) await broadcastScores(game.id)
  return { correct: result.correct, total: result.total, status: result.status }
}

/** The answer the host saw: its id, and when its current text arrived. */
export type SeenAnswer = Pick<Answer, 'id' | 'receivedAt'>

/**
 * The host marks typed answers right or wrong (ADR 0023), for the question shown or one
 * already closed. A right answer scores the question's points for its team (or player), and
 * changing a mark moves them. On a closed question the status follows the marks: `correct`
 * when any is right, `incorrect` otherwise. An open question keeps taking answers until it is
 * closed. Answers of another game, choices (which are marked automatically), and answers the
 * player replaced since the host saw them are left alone. Resolves to how many changed.
 */
export async function markTypedAnswers(
  game: Pick<Game, 'id' | 'scoringEnabled'>,
  seen: SeenAnswer[],
  ruling: Exclude<Answer['ruling'], 'pending'>
): Promise<number> {
  const result = await db.transaction('rw', RULING_TABLES, async () => {
    const rows = await db.answers.bulkGet(seen.map(s => s.id))
    let changed = 0
    let scored = false
    const touched = new Map<string, GameQuestion>()
    const marked: { questionId: string; name: string }[] = []
    for (const [i, a] of rows.entries()) {
      if (!a || a.gameId !== game.id || a.text === null || a.ruling === ruling) continue
      // Replaced since the host saw it: the mark was meant for the earlier text
      if (a.receivedAt !== seen[i].receivedAt) continue
      const gq = touched.get(a.gameQuestionId) ?? (await db.gameQuestions.get(a.gameQuestionId))
      if (!gq || gq.gameId !== game.id) continue
      touched.set(gq.id, gq)
      scored = (await setRuling(game, a, ruling, gq, await questionPoints(gq.questionId))) || scored
      changed++
      const team = a.teamId ? await db.teams.get(a.teamId) : undefined
      const name = (team ?? (await db.players.get(a.playerId)))?.name ?? ''
      marked.push({ questionId: gq.questionId, name })
    }
    for (const gq of touched.values()) {
      if (gq.status === 'pending') continue
      const answers = await db.answers.where('gameQuestionId').equals(gq.id).toArray()
      const status: GameQuestion['status'] = answers.some(a => a.ruling === 'correct')
        ? 'correct'
        : 'incorrect'
      if (status !== gq.status) await db.gameQuestions.update(gq.id, { status })
    }
    return { changed, scored, marked }
  })
  for (const { questionId, name } of result.marked) {
    logEvent(game.id, 'answer_marked', { subjectId: questionId, data: { name, ruling } })
  }
  if (result.scored) await broadcastScores(game.id)
  return result.changed
}
