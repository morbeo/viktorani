// The game master's live tools (#523), over fake game master handlers.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { answerConfirmation, denyAllConfirmations, readConfirmations } from '@/lib/ai-tools'
import type { WebMcpTool } from '@/lib/ai-tools'
import { RateLimiter } from '@/lib/rate-limit'
import { buildGameTools, buildPlayTools, LIVE_TOOL_LIMIT } from '@/pages/admin/live-tools'
import type { LiveGameApi, LivePlayApi, LiveQuestion } from '@/pages/admin/live-tools'
import type { Game, Player, Team, Timer } from '@/db'

const game = { id: 'g1', name: 'Quiz night', status: 'active', buzzerLocked: true } as Game
const teams = [{ id: 't1', name: 'Owls', score: 3 }] as Team[]
const players = [
  { id: 'p1', name: 'Ana', teamId: 't1', score: 2, presence: 'connected', deviceId: 'dev-1' },
  { id: 'p2', name: 'Bo', teamId: null, score: 0, presence: 'disconnected', deviceId: 'dev-2' },
  { id: 'p3', name: 'Cy', teamId: null, score: 0, presence: 'kicked', deviceId: 'dev-3' },
] as Player[]

function gameApi(over: Partial<LiveGameApi> = {}): LiveGameApi {
  return {
    game: () => game,
    players: () => players,
    teams: () => teams,
    log: async () => [],
    adjustScore: vi.fn(async () => {}),
    sendMessage: vi.fn(() => 2),
    pause: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    end: vi.fn(async () => {}),
    kick: vi.fn(async () => {}),
    ...over,
  }
}

const question: LiveQuestion = {
  round: 'Round 1',
  number: 2,
  total: 10,
  title: 'Capital of France?',
  description: '',
  type: 'open',
  options: [],
  answer: 'Paris',
  status: 'pending',
  revealed: false,
}

function playApi(over: Partial<LivePlayApi> = {}): LivePlayApi {
  return {
    question: () => question,
    buzzes: () => [
      { id: 'b1', player: 'Ana', falseStart: false, decision: null },
      { id: 'b2', player: 'Bo', falseStart: false, decision: 'Incorrect' },
    ],
    timers: () =>
      [{ id: 'tm1', label: 'Question', remaining: 30, paused: true, startedAt: null }] as Timer[],
    players: () => players,
    teams: () => teams,
    takesAnswers: () => true,
    next: vi.fn(async () => true),
    previous: vi.fn(async () => {}),
    setBuzzerLocked: vi.fn(async () => {}),
    ruleBuzz: vi.fn(async () => {}),
    rule: vi.fn(async () => {}),
    markAnswers: vi.fn(async () => {}),
    reveal: vi.fn(async () => {}),
    timer: vi.fn(async () => {}),
    ...over,
  }
}

const fresh = () => new RateLimiter(LIVE_TOOL_LIMIT, 10_000)

function call(tools: WebMcpTool[], name: string, args: Record<string, unknown> = {}) {
  const tool = tools.find(t => t.name === name)
  if (!tool) throw new Error(`no tool ${name}`)
  return tool.execute(args)
}

beforeEach(() => denyAllConfirmations())

describe('game tools', () => {
  it('describe the game without device ids or kicked players', async () => {
    const tools = buildGameTools(gameApi(), fresh())
    const text = await call(tools, 'get_game')
    expect(text).not.toMatch(/dev-/)
    const state = JSON.parse(text)
    expect(state.players.map((p: { name: string }) => p.name)).toEqual(['Ana', 'Bo'])
    expect(state.teams[0]).toMatchObject({ name: 'Owls', members: ['Ana'] })
    expect(state.players[1]).toMatchObject({ name: 'Bo', connected: false })
  })

  it('mark only reading tools read-only, and give JSON Schemas', () => {
    const tools = buildGameTools(gameApi(), fresh())
    const readOnly = tools.filter(t => t.annotations?.readOnlyHint).map(t => t.name)
    expect(readOnly).toEqual(['get_game', 'get_log'])
    expect(tools.find(t => t.name === 'adjust_score')!.inputSchema).toMatchObject({
      type: 'object',
      required: ['player', 'points'],
    })
  })

  it('adjust a score by player name and refuse an unknown player', async () => {
    const api = gameApi()
    const tools = buildGameTools(api, fresh())
    expect(await call(tools, 'adjust_score', { player: 'ana', points: -2 })).toBe(
      'Took 2 from Ana.'
    )
    expect(api.adjustScore).toHaveBeenCalledWith('p1', -2)
    expect(await call(tools, 'adjust_score', { player: 'Zed', points: 1 })).toMatch(/No player/)
    expect(await call(tools, 'adjust_score', { player: 'Ana', points: 'x' })).toMatch(/Invalid/)
  })

  it('send a message to a team, a player or everyone', async () => {
    const api = gameApi()
    const tools = buildGameTools(api, fresh())
    expect(await call(tools, 'send_message', { to: 'Owls', text: 'Hi' })).toBe('Sent to 2 devices.')
    await call(tools, 'send_message', { to: 'Bo', text: 'Hi' })
    await call(tools, 'send_message', { text: 'Hi' })
    expect(vi.mocked(api.sendMessage).mock.calls.map(c => c[0])).toEqual([
      { kind: 'team', teamId: 't1' },
      { kind: 'player', playerId: 'p2' },
      { kind: 'everyone' },
    ])
  })

  it('kick only after the host allows it', async () => {
    const api = gameApi()
    const tools = buildGameTools(api, fresh())
    const denied = call(tools, 'kick_player', { player: 'Bo' })
    await vi.waitFor(() => expect(readConfirmations()).toHaveLength(1))
    expect(readConfirmations()[0].title).toBe('Kick Bo')
    answerConfirmation(readConfirmations()[0].id, false)
    expect(await denied).toBe('The host denied this.')
    expect(api.kick).not.toHaveBeenCalled()

    const allowed = call(tools, 'kick_player', { player: 'Bo' })
    await vi.waitFor(() => expect(readConfirmations()).toHaveLength(1))
    answerConfirmation(readConfirmations()[0].id, true)
    expect(await allowed).toBe('Kicked Bo.')
    expect(api.kick).toHaveBeenCalledWith('p2')
  })

  it('end the game only after the host allows it', async () => {
    const api = gameApi()
    const ending = call(buildGameTools(api, fresh()), 'end_game')
    await vi.waitFor(() => expect(readConfirmations()).toHaveLength(1))
    answerConfirmation(readConfirmations()[0].id, true)
    expect(await ending).toBe('The game has ended.')
    expect(api.end).toHaveBeenCalled()
  })

  it('refuse changes to an ended game but still read it', async () => {
    const tools = buildGameTools(gameApi({ game: () => ({ ...game, status: 'ended' }) }), fresh())
    expect(await call(tools, 'pause_game')).toBe('The game has ended.')
    expect(JSON.parse(await call(tools, 'get_game')).status).toBe('ended')
  })

  it('limit how fast an assistant acts, but not reads', async () => {
    const tools = buildGameTools(gameApi(), new RateLimiter(2, 10_000))
    await call(tools, 'send_message', { text: 'a' })
    await call(tools, 'send_message', { text: 'b' })
    expect(await call(tools, 'send_message', { text: 'c' })).toMatch(/Too many/)
    expect(await call(tools, 'get_game')).toMatch(/Quiz night/)
  })
})

describe('play tools', () => {
  it('describe the question, its buzzes and timers', async () => {
    const state = JSON.parse(await call(buildPlayTools(playApi(), fresh()), 'get_question'))
    expect(state.question).toMatchObject({ title: 'Capital of France?', answer: 'Paris' })
    expect(state.buzzes[0]).toEqual({ id: 'b1', player: 'Ana', falseStart: false, decision: null })
    expect(state.timers).toEqual([{ id: 'tm1', label: 'Question', seconds: 30, running: false }])
  })

  it('rule a buzz once', async () => {
    const api = playApi()
    const tools = buildPlayTools(api, fresh())
    expect(await call(tools, 'rule_buzz', { buzz: 'b1', ruling: 'correct' })).toBe(
      'Ruled Ana: correct.'
    )
    expect(api.ruleBuzz).toHaveBeenCalledWith('b1', 'Correct')
    expect(await call(tools, 'rule_buzz', { buzz: 'b2', ruling: 'skip' })).toMatch(/already ruled/)
  })

  it('rule the question, awarding a team or player by name', async () => {
    const api = playApi()
    const tools = buildPlayTools(api, fresh())
    await call(tools, 'rule_question', { ruling: 'correct', award: 'Owls' })
    await call(tools, 'rule_question', { ruling: 'correct', award: 'Bo' })
    await call(tools, 'rule_question', { ruling: 'skipped', award: 'Bo' })
    expect(vi.mocked(api.rule).mock.calls).toEqual([
      ['correct', { kind: 'team', id: 't1' }],
      ['correct', { kind: 'player', id: 'p2' }],
      ['skipped', null],
    ])
  })

  it('say when moving on waits for the host', async () => {
    const tools = buildPlayTools(playApi({ next: async () => false }), fresh())
    expect(await call(tools, 'next_question')).toMatch(/host was asked to confirm/)
  })

  it('control a timer by label and the buzzer lock', async () => {
    const api = playApi()
    const tools = buildPlayTools(api, fresh())
    expect(await call(tools, 'control_timer', { timer: 'question', action: 'start' })).toBe(
      'Started Question.'
    )
    expect(api.timer).toHaveBeenCalledWith('tm1', 'start')
    await call(tools, 'set_buzzer', { locked: false })
    expect(api.setBuzzerLocked).toHaveBeenCalledWith(false)
  })

  it('refuse when no question is shown', async () => {
    const tools = buildPlayTools(playApi({ question: () => null }), fresh())
    expect(await call(tools, 'reveal_answer')).toBe('No question is shown.')
  })
})
