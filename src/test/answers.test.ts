// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db'
import type { Game, Player, Team } from '@/db'
import {
  choiceOptions,
  markAnswers,
  markTypedAnswers,
  normaliseAnswerText,
  recordAnswer,
  recountVotes,
  staleVotes,
  tallyVotes,
  teamCaptain,
  textMatches,
} from '@/db/answers'
import { ruleQuestion } from '@/db/rulings'

vi.mock('@/transport', () => ({ transportManager: { send: vi.fn() } }))

import { transportManager } from '@/transport'

const GAME = { id: 'g1', scoringEnabled: true }

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    gameId: 'g1',
    name: 'Alice',
    teamId: null,
    score: 0,
    presence: 'connected',
    disconnectedAt: null,
    deviceId: 'dev-a',
    joinedAt: 1,
    notes: '',
    ...overrides,
  }
}

function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 't1',
    gameId: 'g1',
    name: 'Reds',
    color: '#f00',
    icon: 'Shield',
    score: 0,
    notes: '',
    ...overrides,
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all(db.tables.map(t => t.clear()))
  // Only the fields recording an answer reads
  await db.games.add({ id: 'g1', inputType: 'choice', scoringEnabled: true } as Game)
  await db.difficulties.add({ id: 'hard', name: 'Hard', score: 3, color: '#000', order: 0 })
  await db.questions.add({
    id: 'q1',
    title: 'Capital of France?',
    type: 'multiple_choice',
    options: ['Lyon', 'Paris', 'Nice', 'Lille'],
    answer: 'Paris',
    description: '',
    difficulty: 'hard',
    tags: [],
    media: null,
    mediaType: null,
    createdAt: 0,
    updatedAt: 0,
  })
  await db.gameQuestions.add({
    id: 'gq1',
    gameId: 'g1',
    questionId: 'q1',
    roundId: 'r1',
    order: 0,
    status: 'pending',
    revealed: false,
  })
  await db.players.bulkAdd([player(), player({ id: 'p2', name: 'Bob', deviceId: 'dev-b' })])
})

const answers = () => db.answers.where('gameQuestionId').equals('gq1').toArray()
const status = async () => (await db.gameQuestions.get('gq1'))?.status

describe('choiceOptions', () => {
  it('gives true/false questions their two options and open-ended ones none', () => {
    expect(choiceOptions({ type: 'true_false', options: [] })).toEqual(['True', 'False'])
    expect(choiceOptions({ type: 'multiple_choice', options: ['A', 'B'] })).toEqual(['A', 'B'])
    expect(choiceOptions({ type: 'open_ended', options: ['x'] })).toEqual([])
  })
})

describe('recordAnswer', () => {
  it("stores a player's choice with the host's player and clock", async () => {
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 500)).toBe(true)
    expect(await answers()).toEqual([
      expect.objectContaining({
        gameId: 'g1',
        playerId: 'p1',
        teamId: null,
        choice: 1,
        receivedAt: 500,
        ruling: 'pending',
      }),
    ])
  })

  it("replaces a player's earlier choice", async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 0 }, 1)
    await recordAnswer('g1', 'gq1', 'p1', { choice: 2 }, 2)
    expect(await answers()).toEqual([expect.objectContaining({ choice: 2, receivedAt: 2 })])
  })

  it('keeps one answer per team, from whichever member sent it last', async () => {
    await db.teams.add(team())
    await db.players.bulkUpdate([
      { key: 'p1', changes: { teamId: 't1' } },
      { key: 'p2', changes: { teamId: 't1' } },
    ])
    await recordAnswer('g1', 'gq1', 'p1', { choice: 0 }, 1)
    await recordAnswer('g1', 'gq1', 'p2', { choice: 1 }, 2)
    expect(await answers()).toEqual([
      expect.objectContaining({ teamId: 't1', playerId: 'p2', choice: 1 }),
    ])
  })

  it('refuses an option the question does not have', async () => {
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 4 }, 1)).toBe(false)
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: -1 }, 1)).toBe(false)
    expect(await answers()).toEqual([])
  })

  it("refuses another game's question or player", async () => {
    await db.players.add(player({ id: 'p9', gameId: 'g2', deviceId: 'dev-9' }))
    expect(await recordAnswer('g2', 'gq1', 'p9', { choice: 1 }, 1)).toBe(false)
    expect(await recordAnswer('g1', 'gq1', 'p9', { choice: 1 }, 1)).toBe(false)
    expect(await answers()).toEqual([])
  })

  it('refuses answers once the answer is revealed, though the question is open', async () => {
    await db.gameQuestions.update('gq1', { revealed: true })
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)).toBe(false)
    expect(await answers()).toEqual([])
  })

  it('refuses answers once the question is closed', async () => {
    await db.gameQuestions.update('gq1', { status: 'incorrect' })
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)).toBe(false)
  })

  it('refuses a question with no options', async () => {
    await db.questions.update('q1', { type: 'open_ended', options: [] })
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 0 }, 1)).toBe(false)
  })
})

describe('markAnswers', () => {
  it('marks each answer, scores the right ones and closes the question', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    await recordAnswer('g1', 'gq1', 'p2', { choice: 0 }, 2)

    expect(await markAnswers(GAME, 'gq1')).toEqual({ correct: 1, total: 2, status: 'correct' })

    const byPlayer = new Map((await answers()).map(a => [a.playerId, a.ruling]))
    expect(byPlayer).toEqual(
      new Map([
        ['p1', 'correct'],
        ['p2', 'incorrect'],
      ])
    )
    expect((await db.players.get('p1'))?.score).toBe(3)
    expect((await db.players.get('p2'))?.score).toBe(0)
    expect(await status()).toBe('correct')
    expect(transportManager.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SCORE_UPDATE' })
    )
    const log = await db.gameLog.where('gameId').equals('g1').toArray()
    expect(log).toEqual([
      expect.objectContaining({ kind: 'answers_marked', data: { correct: 1, total: 2 } }),
    ])
  })

  it('scores several right answers', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    await recordAnswer('g1', 'gq1', 'p2', { choice: 1 }, 2)
    await markAnswers(GAME, 'gq1')
    expect((await db.players.get('p1'))?.score).toBe(3)
    expect((await db.players.get('p2'))?.score).toBe(3)
  })

  it("scores a team's right answer for the team only", async () => {
    await db.teams.add(team())
    await db.players.update('p1', { teamId: 't1' })
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    await markAnswers(GAME, 'gq1')
    expect((await db.teams.get('t1'))?.score).toBe(3)
    expect((await db.players.get('p1'))?.score).toBe(0)
  })

  it('marks the question wrong when nobody was right', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 0 }, 1)
    expect(await markAnswers(GAME, 'gq1')).toEqual({ correct: 0, total: 1, status: 'incorrect' })
    expect(await status()).toBe('incorrect')
  })

  it('marks answers once, so running it again scores nothing more', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    await markAnswers(GAME, 'gq1')
    expect(await markAnswers(GAME, 'gq1')).toBeNull()
    expect((await db.players.get('p1'))?.score).toBe(3)
  })

  it('leaves the question alone when nobody answered', async () => {
    expect(await markAnswers(GAME, 'gq1')).toBeNull()
    expect(await status()).toBe('pending')
  })

  it('closes a question nobody answered as told, so no answer slips in after', async () => {
    expect(await markAnswers(GAME, 'gq1', 'skipped')).toBeNull()
    expect(await status()).toBe('skipped')
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)).toBe(false)
  })

  it('closes by the answers, not as told, when there are answers to mark', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    await markAnswers(GAME, 'gq1', 'skipped')
    expect(await status()).toBe('correct')
  })

  it('marks without scoring when scoring is off', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    await markAnswers({ id: 'g1', scoringEnabled: false }, 'gq1')
    expect((await answers())[0].ruling).toBe('correct')
    expect((await db.players.get('p1'))?.score).toBe(0)
    expect(await status()).toBe('correct')
  })

  it("ignores another game's question", async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    expect(await markAnswers({ id: 'g2', scoringEnabled: true }, 'gq1')).toBeNull()
    expect((await answers())[0].ruling).toBe('pending')
  })

  it("keeps a ruling's points from adding to an answer's", async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    await markAnswers(GAME, 'gq1')
    await ruleQuestion(GAME, 'gq1', 'correct', { kind: 'player', id: 'p1' })
    expect((await db.players.get('p1'))?.score).toBe(3)
  })
})

describe('typed answers', () => {
  const textGame = () => db.games.update('g1', { inputType: 'text' })
  const typed = (playerId: string, text: string, at = 1) =>
    recordAnswer('g1', 'gq1', playerId, { text }, at)
  const answerOf = async (playerId: string) => (await answers()).find(a => a.playerId === playerId)!

  beforeEach(async () => {
    await textGame()
    await db.questions.update('q1', { type: 'open_ended', options: [] })
  })

  it('normalises spacing and matches ignoring case', () => {
    expect(normaliseAnswerText('  New   York\n')).toBe('New York')
    expect(textMatches(' new york ', 'New  York')).toBe(true)
    expect(textMatches('Newark', 'New York')).toBe(false)
    expect(textMatches('', '')).toBe(false)
  })

  it('stores trimmed text and takes only text in a text game', async () => {
    expect(await typed('p1', '  Paris  ')).toBe(true)
    expect(await answers()).toEqual([expect.objectContaining({ text: 'Paris', choice: null })])
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 2)).toBe(false)
  })

  it('refuses blank or too long text, and text in a choice game', async () => {
    expect(await typed('p1', '   ')).toBe(false)
    expect(await typed('p1', 'x'.repeat(201))).toBe(false)
    await db.games.update('g1', { inputType: 'choice' })
    expect(await typed('p1', 'Paris')).toBe(false)
    expect(await answers()).toEqual([])
  })

  it('leaves typed answers for the host when the question closes', async () => {
    await typed('p1', 'Paris')
    expect(await markAnswers(GAME, 'gq1')).toEqual({ correct: 0, total: 0, status: 'incorrect' })
    expect((await answerOf('p1')).ruling).toBe('pending')
    expect(await typed('p2', 'Lyon')).toBe(false)
  })

  it('scores a typed answer the host marks right, and takes the points back on a change', async () => {
    await typed('p1', 'Paris')
    const seen = await answerOf('p1')

    expect(await markTypedAnswers(GAME, [seen], 'correct')).toBe(1)
    expect((await db.players.get('p1'))?.score).toBe(3)
    expect(await status()).toBe('pending')

    await markTypedAnswers(GAME, [seen], 'incorrect')
    expect((await db.players.get('p1'))?.score).toBe(0)
    expect((await answerOf('p1')).ruling).toBe('incorrect')
  })

  it('updates a closed question as its answers are marked', async () => {
    await typed('p1', 'Paris')
    await typed('p2', 'Lyon')
    await markAnswers(GAME, 'gq1', 'skipped')
    expect(await status()).toBe('incorrect')

    await markTypedAnswers(GAME, [await answerOf('p1')], 'correct')
    expect(await status()).toBe('correct')
    await markTypedAnswers(GAME, [await answerOf('p1')], 'incorrect')
    expect(await status()).toBe('incorrect')
  })

  it("puts a changed answer back to unmarked, without the old one's points", async () => {
    await typed('p1', 'Paris')
    await markTypedAnswers(GAME, [await answerOf('p1')], 'correct')
    await typed('p1', 'Lyon', 2)
    expect(await answerOf('p1')).toMatchObject({ text: 'Lyon', ruling: 'pending' })
    expect((await db.players.get('p1'))?.score).toBe(0)
  })

  it("ignores another game's answers and choices", async () => {
    await db.answers.bulkAdd([
      {
        id: 'other',
        gameId: 'g2',
        gameQuestionId: 'gq1',
        playerId: 'p1',
        teamId: null,
        choice: null,
        text: 'Paris',
        receivedAt: 1,
        ruling: 'pending',
      },
      {
        id: 'picked',
        gameId: 'g1',
        gameQuestionId: 'gq1',
        playerId: 'p2',
        teamId: null,
        choice: 1,
        text: null,
        receivedAt: 1,
        ruling: 'pending',
      },
    ])
    const seen = ['other', 'picked', 'missing'].map(id => ({ id, receivedAt: 1 }))
    expect(await markTypedAnswers(GAME, seen, 'correct')).toBe(0)
    expect((await db.players.get('p1'))?.score).toBe(0)
  })

  it('leaves an answer replaced since the host saw it unmarked', async () => {
    await typed('p1', 'Paris', 1)
    const seen = await answerOf('p1')
    await typed('p1', 'Lyon', 2)
    expect(await markTypedAnswers(GAME, [seen], 'correct')).toBe(0)
    expect(await answerOf('p1')).toMatchObject({ text: 'Lyon', ruling: 'pending' })
    expect((await db.players.get('p1'))?.score).toBe(0)
  })

  it('logs who was marked', async () => {
    await typed('p1', 'Paris')
    await markTypedAnswers(GAME, [await answerOf('p1')], 'correct')
    const log = await db.gameLog.where('gameId').equals('g1').toArray()
    expect(log).toEqual([
      expect.objectContaining({
        kind: 'answer_marked',
        subjectId: 'q1',
        data: { name: 'Alice', ruling: 'correct' },
      }),
    ])
  })
})

describe('teamCaptain', () => {
  const members = [
    player({ id: 'p1', teamId: 't1', joinedAt: 5 }),
    player({ id: 'p2', teamId: 't1', joinedAt: 2 }),
    player({ id: 'p3', teamId: 't2', joinedAt: 1 }),
  ]

  it("is the host's pick while on the team, else the member who joined first", () => {
    expect(teamCaptain(team(), members)).toBe('p2')
    expect(teamCaptain(team({ captainId: 'p1' }), members)).toBe('p1')
    expect(teamCaptain(team({ captainId: 'p3' }), members)).toBe('p2')
  })

  it('skips members who left or were removed, and is null for an empty team', () => {
    const gone = members.map(p => (p.id === 'p2' ? { ...p, presence: 'left' as const } : p))
    expect(teamCaptain(team({ captainId: 'p2' }), gone)).toBe('p1')
    expect(teamCaptain(team({ id: 't9' }), members)).toBeNull()
  })
})

describe('recordAnswer: team answering modes', () => {
  async function teamGame(teamAnswering: Game['teamAnswering'], captainId?: string) {
    await db.games.update('g1', { teamAnswering })
    await db.teams.add(team({ captainId }))
    await db.players.bulkUpdate([
      { key: 'p1', changes: { teamId: 't1', joinedAt: 1 } },
      { key: 'p2', changes: { teamId: 't1', joinedAt: 2 } },
    ])
  }

  it('lets only the captain answer for the team', async () => {
    await teamGame('captain')
    expect(await recordAnswer('g1', 'gq1', 'p2', { choice: 1 }, 1)).toBe(false)
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 2)).toBe(true)
    expect(await answers()).toEqual([expect.objectContaining({ playerId: 'p1', choice: 1 })])
  })

  it("follows the host's choice of captain", async () => {
    await teamGame('captain', 'p2')
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)).toBe(false)
    expect(await recordAnswer('g1', 'gq1', 'p2', { choice: 1 }, 2)).toBe(true)
  })

  it('holds the first reply: only the member who sent it may change it', async () => {
    await teamGame('firstReply')
    expect(await recordAnswer('g1', 'gq1', 'p2', { choice: 0 }, 1)).toBe(true)
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 2)).toBe(false)
    expect(await recordAnswer('g1', 'gq1', 'p2', { choice: 2 }, 3)).toBe(true)
    expect(await answers()).toEqual([expect.objectContaining({ playerId: 'p2', choice: 2 })])
  })

  it('lets the team change a first reply once its sender is off the team', async () => {
    await teamGame('firstReply')
    await recordAnswer('g1', 'gq1', 'p2', { choice: 0 }, 1)
    await db.players.update('p2', { presence: 'left' })
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 2)).toBe(true)
    expect(await answers()).toEqual([expect.objectContaining({ playerId: 'p1', choice: 1 })])
  })

  it('ignores the mode for players on no team', async () => {
    await db.games.update('g1', { teamAnswering: 'captain' })
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)).toBe(true)
  })
})

describe('tallyVotes', () => {
  const vote = (
    playerId: string,
    at: number,
    choice: number | null,
    text: string | null = null
  ) => ({
    playerId,
    at,
    choice,
    text,
  })

  it('puts the most votes first, and a tie to the answer voted for first', () => {
    expect(tallyVotes([vote('p1', 3, 2), vote('p2', 1, 0), vote('p3', 2, 2)])).toEqual([
      { choice: 2, text: null, count: 2, playerId: 'p3', at: 2 },
      { choice: 0, text: null, count: 1, playerId: 'p2', at: 1 },
    ])
    expect(tallyVotes([vote('p1', 2, 1), vote('p2', 1, 3)]).map(t => t.choice)).toEqual([3, 1])
  })

  it('counts typed answers as the same ignoring case and spacing', () => {
    const [top] = tallyVotes([vote('p1', 1, null, 'New  York'), vote('p2', 2, null, 'new york')])
    expect(top).toMatchObject({ text: 'New  York', count: 2 })
  })
})

describe('recordAnswer: team vote', () => {
  beforeEach(async () => {
    await db.games.update('g1', { teamAnswering: 'vote' })
    await db.teams.add(team())
    await db.players.bulkUpdate([
      { key: 'p1', changes: { teamId: 't1' } },
      { key: 'p2', changes: { teamId: 't1' } },
    ])
    await db.players.add(player({ id: 'p3', name: 'Cy', deviceId: 'dev-c', teamId: 't1' }))
  })

  it("makes the most voted answer the team's, keeping each member's latest vote", async () => {
    expect(await recordAnswer('g1', 'gq1', 'p1', { choice: 0 }, 1)).toBe(true)
    await recordAnswer('g1', 'gq1', 'p2', { choice: 1 }, 2)
    expect(await answers()).toEqual([expect.objectContaining({ playerId: 'p1', choice: 0 })])
    await recordAnswer('g1', 'gq1', 'p3', { choice: 1 }, 3)
    expect(await answers()).toEqual([expect.objectContaining({ playerId: 'p2', choice: 1 })])
    // Cy changes their vote, so the tie goes back to the answer voted for first
    await recordAnswer('g1', 'gq1', 'p3', { choice: 0 }, 4)
    const [answer] = await answers()
    expect(answer).toMatchObject({ choice: 0 })
    expect(answer.votes?.map(v => [v.playerId, v.choice])).toEqual([
      ['p1', 0],
      ['p2', 1],
      ['p3', 0],
    ])
  })

  it('keeps the mark while the leading answer stays, and clears it when it changes', async () => {
    await db.games.update('g1', { inputType: 'text' })
    await recordAnswer('g1', 'gq1', 'p1', { text: 'Paris' }, 1)
    await markTypedAnswers(GAME, [{ id: (await answers())[0].id, receivedAt: 1 }], 'correct')
    await recordAnswer('g1', 'gq1', 'p2', { text: 'paris' }, 2)
    expect(await answers()).toEqual([expect.objectContaining({ text: 'Paris', ruling: 'correct' })])
    await recordAnswer('g1', 'gq1', 'p2', { text: 'Rome' }, 3)
    await recordAnswer('g1', 'gq1', 'p3', { text: 'Rome' }, 4)
    expect(await answers()).toEqual([expect.objectContaining({ text: 'Rome', ruling: 'pending' })])
  })

  it('drops the votes of members off the team', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 0 }, 1)
    await recordAnswer('g1', 'gq1', 'p2', { choice: 0 }, 2)
    await db.players.update('p1', { presence: 'kicked' })
    await recordAnswer('g1', 'gq1', 'p3', { choice: 1 }, 3)
    const [answer] = await answers()
    expect(answer.votes?.map(v => v.playerId)).toEqual(['p2', 'p3'])
    expect(answer.choice).toBe(0)
  })

  it('recounts once a voter leaves, so their vote no longer decides', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 0 }, 1)
    await recordAnswer('g1', 'gq1', 'p2', { choice: 1 }, 2)
    await db.players.update('p1', { presence: 'kicked' })
    const [before] = await answers()
    expect(staleVotes([before], await db.players.toArray())).toEqual([before.id])
    expect(await recountVotes('g1', before.id, 3)).toBe(true)
    expect(await answers()).toEqual([expect.objectContaining({ playerId: 'p2', choice: 1 })])
    expect(staleVotes(await answers(), await db.players.toArray())).toEqual([])
    expect(await recountVotes('g1', before.id, 4)).toBe(false)
  })

  it('removes the answer once no voter is left, and leaves closed questions alone', async () => {
    await recordAnswer('g1', 'gq1', 'p1', { choice: 1 }, 1)
    await db.players.update('p1', { teamId: null })
    const [answer] = await answers()
    await db.gameQuestions.update('gq1', { revealed: true })
    expect(await recountVotes('g1', answer.id, 2)).toBe(false)
    await db.gameQuestions.update('gq1', { revealed: false })
    expect(await recountVotes('g1', answer.id, 3)).toBe(true)
    expect(await answers()).toEqual([])
  })
})
