// @vitest-pool vmForks
import { describe, it, expect } from 'vitest'
import { teamAnswerView } from '@/pages/player/team-answer'
import type { TeamAnswers } from '@/pages/player/team-answer'
import { buildTeamAnswers } from '@/pages/admin/gamemaster-utils'

const bobsAnswer = {
  questionId: 'q1',
  playerId: 'p2',
  playerName: 'Bob',
  choice: 1,
  text: null,
  votes: [],
}

function team(overrides: Partial<TeamAnswers> = {}): TeamAnswers {
  return { mode: 'anyone', captainId: null, captainName: null, answers: [], ...overrides }
}

describe('teamAnswerView', () => {
  it("shows this phone's own answer outside a team game", () => {
    expect(teamAnswerView(null, 'q1', 'p1', { choice: 2 })).toEqual({
      canAnswer: true,
      choice: 2,
      text: null,
      note: null,
    })
  })

  it("shows a teammate's answer, which anyone may change", () => {
    const view = teamAnswerView(team({ answers: [bobsAnswer] }), 'q1', 'p1', { choice: 0 })
    expect(view).toMatchObject({ canAnswer: true, choice: 1 })
    expect(view.note).toBe('Team answer: B, from Bob.')
  })

  it("locks the pad once a teammate's first reply holds", () => {
    const view = teamAnswerView(
      team({ mode: 'firstReply', answers: [bobsAnswer] }),
      'q1',
      'p1',
      undefined
    )
    expect(view).toMatchObject({ canAnswer: false, choice: 1 })
    expect(view.note).toBe('Bob answered first for your team: B.')
    // Bob himself can still change it
    expect(
      teamAnswerView(team({ mode: 'firstReply', answers: [bobsAnswer] }), 'q1', 'p2', undefined)
        .canAnswer
    ).toBe(true)
  })

  it('lets only the captain answer', () => {
    const captained = team({ mode: 'captain', captainId: 'p2', captainName: 'Bob' })
    expect(teamAnswerView(captained, 'q1', 'p1', undefined)).toMatchObject({
      canAnswer: false,
      note: 'Bob answers for your team.',
    })
    expect(teamAnswerView(captained, 'q1', 'p2', undefined)).toMatchObject({
      canAnswer: true,
      note: 'You answer for your team.',
    })
  })

  it("shows this phone's own vote and the team's counts in a team vote", () => {
    const voted = team({
      mode: 'vote',
      answers: [
        {
          ...bobsAnswer,
          votes: [
            { choice: 1, text: null, count: 2 },
            { choice: 0, text: null, count: 1 },
          ],
        },
      ],
    })
    expect(teamAnswerView(voted, 'q1', 'p1', { choice: 0 })).toEqual({
      canAnswer: true,
      choice: 0,
      text: null,
      note: 'Team vote: B 2, A 1. Most votes counts.',
    })
    expect(teamAnswerView(team({ mode: 'vote' }), 'q1', 'p1', undefined)).toMatchObject({
      canAnswer: true,
      choice: null,
      note: 'Your answer is a vote for your team.',
    })
  })
})

describe('buildTeamAnswers', () => {
  const players = [
    { id: 'p1', name: 'Alice', teamId: 't1', joinedAt: 1, presence: 'connected' as const },
    { id: 'p2', name: 'Bob', teamId: 't1', joinedAt: 2, presence: 'connected' as const },
  ]
  const answer = (gameQuestionId: string, teamId: string | null) => ({
    gameQuestionId,
    teamId,
    playerId: 'p2',
    choice: null,
    text: 'Paris',
  })

  it("lists the team's answers to open questions, with the captain in captain mode", () => {
    const event = buildTeamAnswers(
      'captain',
      { id: 't1', captainId: null },
      players,
      [answer('gq1', 't1'), answer('gq1', 't2'), answer('gq9', 't1')],
      new Map([['gq1', 'q1']])
    )
    expect(event).toEqual({
      type: 'TEAM_ANSWERS',
      mode: 'captain',
      captainId: 'p1',
      captainName: 'Alice',
      answers: [
        {
          questionId: 'q1',
          playerId: 'p2',
          playerName: 'Bob',
          choice: null,
          text: 'Paris',
          votes: [],
        },
      ],
    })
  })

  it("drops a first reply whose sender left, so it doesn't hold", () => {
    const gone = players.map(p => (p.id === 'p2' ? { ...p, presence: 'left' as const } : p))
    const event = buildTeamAnswers(
      'firstReply',
      { id: 't1' },
      gone,
      [answer('gq1', 't1')],
      new Map([['gq1', 'q1']])
    )
    expect(event.answers).toEqual([])
  })

  it('carries the vote counts in vote mode', () => {
    const votes = [
      { playerId: 'p1', choice: null, text: 'Rome', at: 1 },
      { playerId: 'p2', choice: null, text: 'paris', at: 2 },
      { playerId: 'p3', choice: null, text: 'Paris ', at: 3 },
    ]
    const event = buildTeamAnswers(
      'vote',
      { id: 't1' },
      players,
      [{ ...answer('gq1', 't1'), votes }],
      new Map([['gq1', 'q1']])
    )
    expect(event.answers[0].votes).toEqual([
      { choice: null, text: 'paris', count: 2 },
      { choice: null, text: 'Rome', count: 1 },
    ])
  })

  it('names no captain in other modes', () => {
    const event = buildTeamAnswers('anyone', { id: 't1' }, players, [], new Map())
    expect(event).toMatchObject({ captainId: null, captainName: null, answers: [] })
  })
})
