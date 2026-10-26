import { z } from 'zod'
import { aiToolLimiter, requestConfirmation } from '@/lib/ai-tools'
import type { WebMcpTool } from '@/lib/ai-tools'
import type { RateLimiter } from '@/lib/rate-limit'
import type { Game, GmDecision, Player, Team, Timer } from '@/db'
import type { QuestionRuling, RulingAward } from '@/db/rulings'
import { MAX_MESSAGE_LENGTH } from '@/transport/messages'
import type { LogEntry } from '@/transport/types'
import type { MessageTarget } from '@/pages/admin/player-connections'

/**
 * The game master's live tools for an AI assistant (ADR 0021, step 2), registered through
 * WebMCP while a game is open. Each tool calls the same handler as a GM control. Nothing
 * here returns a player's device id or a connection's peer id: players are named by their
 * host-assigned id and name only.
 */

/** A refused request the assistant can correct, such as an unknown player. */
export class LiveToolError extends Error {
  override name = 'LiveToolError'
}

interface LiveTool<S extends z.ZodObject> {
  name: string
  description: string
  input: S
  /** Reads only; not rate limited. */
  read?: boolean
  /** Waits for the host's click in the game master before running. */
  confirm?: (args: z.output<S>) => { title: string; detail?: string }
  run(args: z.output<S>): Promise<unknown> | unknown
}

function tool<S extends z.ZodObject>(def: LiveTool<S>): LiveTool<S> {
  return def
}

/** Turn a tool definition into a WebMCP tool sharing `limiter` with its set. */
function toWebMcp<S extends z.ZodObject>(def: LiveTool<S>, limiter: RateLimiter): WebMcpTool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: z.toJSONSchema(def.input, { io: 'input' }) as Record<string, unknown>,
    annotations: { readOnlyHint: Boolean(def.read) },
    async execute(raw) {
      if (!def.read && !limiter.allow('assistant')) {
        return 'Too many actions in a short time. Wait a few seconds and try again.'
      }
      const parsed = def.input.safeParse(raw ?? {})
      if (!parsed.success) return `Invalid arguments: ${z.prettifyError(parsed.error)}`
      try {
        if (def.confirm) {
          const { title, detail } = def.confirm(parsed.data)
          if (!(await requestConfirmation(title, detail))) return 'The host denied this.'
        }
        const result = await def.run(parsed.data)
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      } catch (e) {
        if (e instanceof LiveToolError) return e.message
        return `Unexpected error: ${(e as Error).message}`
      }
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tools with different inputs
type AnyLiveTool = LiveTool<any>

function toWebMcpSet(defs: AnyLiveTool[], limiter: RateLimiter): WebMcpTool[] {
  return defs.map(d => toWebMcp(d, limiter))
}

/** Find a player by id or by name, ignoring case. */
export function findPlayer(players: readonly Player[], ref: string): Player {
  const key = ref.trim().toLowerCase()
  const player =
    players.find(p => p.id === ref) ?? players.find(p => p.name.trim().toLowerCase() === key)
  if (!player) throw new LiveToolError(`No player "${ref}". Call get_game for the players.`)
  return player
}

/** Find a team by id or by name, ignoring case. */
export function findTeam(teams: readonly Team[], ref: string): Team {
  const key = ref.trim().toLowerCase()
  const team = teams.find(t => t.id === ref) ?? teams.find(t => t.name.trim().toLowerCase() === key)
  if (!team) throw new LiveToolError(`No team "${ref}". Call get_game for the teams.`)
  return team
}

// ── Game tools (the game master page) ─────────────────────────────────────────

/** What the game tools act through: the game master's state and handlers. */
export interface LiveGameApi {
  game(): Game | null
  players(): readonly Player[]
  teams(): readonly Team[]
  /** The log as players may see it. */
  log(): Promise<LogEntry[]>
  adjustScore(playerId: string, delta: number): Promise<void>
  /** Send a message; resolves to how many devices it reached. */
  sendMessage(target: MessageTarget, text: string): number
  pause(): Promise<void>
  resume(): Promise<void>
  end(): Promise<void>
  kick(playerId: string): Promise<void>
}

const NO_ARGS = z.object({})

/** The game in a form for an assistant: no device or connection ids. */
export function describeGame(game: Game, players: readonly Player[], teams: readonly Team[]) {
  const live = players.filter(p => p.presence !== 'kicked')
  return {
    name: game.name,
    status: game.status,
    buzzerLocked: game.buzzerLocked,
    teams: teams.map(t => ({
      id: t.id,
      name: t.name,
      score: t.score,
      members: live.filter(p => p.teamId === t.id).map(p => p.name),
    })),
    players: live.map(p => ({
      id: p.id,
      name: p.name,
      team: teams.find(t => t.id === p.teamId)?.name ?? null,
      score: p.score,
      connected: p.presence === 'connected',
    })),
  }
}

/** The tools for the open game, from the lobby to the end. */
export function buildGameTools(api: LiveGameApi, limiter = aiToolLimiter): WebMcpTool[] {
  function liveGame(): Game {
    const game = api.game()
    if (!game) throw new LiveToolError('No game is open.')
    return game
  }
  function running(): Game {
    const game = liveGame()
    if (game.status === 'ended') throw new LiveToolError('The game has ended.')
    return game
  }
  function target(to: string): MessageTarget {
    switch (to.trim().toLowerCase()) {
      case 'everyone':
        return { kind: 'everyone' }
      case 'players':
        return { kind: 'players' }
      case 'screens':
        return { kind: 'screens' }
    }
    const teams = api.teams()
    const team =
      teams.find(t => t.id === to) ??
      teams.find(t => t.name.trim().toLowerCase() === to.trim().toLowerCase())
    if (team) return { kind: 'team', teamId: team.id }
    return { kind: 'player', playerId: findPlayer(api.players(), to).id }
  }

  return toWebMcpSet(
    [
      tool({
        name: 'get_game',
        description:
          'The open game: its status, whether the buzzer is locked, and its teams and players with scores. Call this first.',
        input: NO_ARGS,
        read: true,
        run: () => describeGame(liveGame(), api.players(), api.teams()),
      }),
      tool({
        name: 'get_log',
        description: 'The latest entries of the game log, as players may see it, newest last.',
        input: z.object({
          limit: z.number().int().min(1).max(200).default(30).describe('How many entries'),
        }),
        read: true,
        run: async ({ limit }) => {
          liveGame()
          return (await api.log()).slice(-limit)
        },
      }),
      tool({
        name: 'adjust_score',
        description: "Add points to a player's score, or take them away with a negative number.",
        input: z.object({
          player: z.string().min(1).describe('The player’s id or name'),
          points: z
            .number()
            .int()
            .min(-1000)
            .max(1000)
            .refine(n => n !== 0, 'Not 0'),
        }),
        run: async ({ player, points }) => {
          running()
          const p = findPlayer(api.players(), player)
          await api.adjustScore(p.id, points)
          return `${points > 0 ? 'Added' : 'Took'} ${Math.abs(points)} ${points > 0 ? 'to' : 'from'} ${p.name}.`
        },
      }),
      tool({
        name: 'send_message',
        description:
          'Show a message on players’ devices and screens. "to" is everyone, players, screens, or a team or player by name or id.',
        input: z.object({
          to: z.string().min(1).default('everyone'),
          text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
        }),
        run: ({ to, text }) => {
          running()
          const reached = api.sendMessage(target(to), text)
          return `Sent to ${reached} device${reached === 1 ? '' : 's'}.`
        },
      }),
      tool({
        name: 'pause_game',
        description: 'Pause the game. Players see it paused until it resumes.',
        input: NO_ARGS,
        run: async () => {
          if (running().status !== 'active') throw new LiveToolError('The game is not running.')
          await api.pause()
          return 'Paused.'
        },
      }),
      tool({
        name: 'resume_game',
        description: 'Resume a paused game.',
        input: NO_ARGS,
        run: async () => {
          if (running().status !== 'paused') throw new LiveToolError('The game is not paused.')
          await api.resume()
          return 'Resumed.'
        },
      }),
      tool({
        name: 'end_game',
        description:
          'End the game for everyone. It cannot be restarted. Waits for the host to allow it in the game master.',
        input: NO_ARGS,
        confirm: () => ({
          title: 'End the game',
          detail: 'Players see the final scores and are disconnected. The game can’t be restarted.',
        }),
        run: async () => {
          const game = running()
          if (game.status === 'waiting') throw new LiveToolError('The game has not started.')
          await api.end()
          return 'The game has ended.'
        },
      }),
      tool({
        name: 'kick_player',
        description:
          'Remove a player from the game; they cannot rejoin it. Waits for the host to allow it in the game master.',
        input: z.object({ player: z.string().min(1).describe('The player’s id or name') }),
        confirm: ({ player }) => {
          const p = findPlayer(api.players(), player)
          return { title: `Kick ${p.name}`, detail: 'They are disconnected and can’t rejoin.' }
        },
        run: async ({ player }) => {
          running()
          const p = findPlayer(api.players(), player)
          if (p.presence === 'kicked') throw new LiveToolError(`${p.name} was already kicked.`)
          await api.kick(p.id)
          return `Kicked ${p.name}.`
        },
      }),
    ],
    limiter
  )
}

// ── Play tools (the question being played) ────────────────────────────────────

/** The question shown, as the play tools describe it. */
export interface LiveQuestion {
  round: string
  /** 1-based position in the game, and how many questions it has. */
  number: number
  total: number
  title: string
  description: string
  type: string
  options: string[]
  answer: string
  status: 'pending' | 'correct' | 'incorrect' | 'skipped'
  revealed: boolean
}

/** A buzz as the play tools describe it: no device or connection ids. */
export interface LiveBuzz {
  id: string
  player: string
  falseStart: boolean
  decision: GmDecision | null
}

/** What the play tools act through: the active game's navigation, buzzer and timers. */
export interface LivePlayApi {
  question(): LiveQuestion | null
  buzzes(): readonly LiveBuzz[]
  timers(): readonly Timer[]
  players(): readonly Player[]
  teams(): readonly Team[]
  /** Whether players answer on their phones (choice or text), so marking applies. */
  takesAnswers(): boolean
  /** Move on; resolves `false` when the host is asked to confirm leaving an unruled question. */
  next(): Promise<boolean>
  previous(): Promise<void>
  setBuzzerLocked(locked: boolean): Promise<void>
  ruleBuzz(buzzId: string, decision: GmDecision): Promise<void>
  rule(ruling: QuestionRuling, award: RulingAward | null): Promise<void>
  markAnswers(): Promise<void>
  reveal(): Promise<void>
  timer(id: string, action: 'start' | 'pause' | 'resume' | 'restart'): Promise<void>
}

/** Seconds left on `timer` at `now`. */
export function timerRemaining(timer: Timer, now = Date.now()): number {
  if (timer.paused || timer.startedAt === null) return timer.remaining
  return Math.max(0, timer.remaining - (now - timer.startedAt) / 1000)
}

const DECISIONS: Record<string, GmDecision> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  skip: 'Skip',
}

const TIMER_DONE = { start: 'Started', pause: 'Paused', resume: 'Resumed', restart: 'Restarted' }

/** The tools for playing questions while the game runs. */
export function buildPlayTools(api: LivePlayApi, limiter = aiToolLimiter): WebMcpTool[] {
  function shown(): LiveQuestion {
    const q = api.question()
    if (!q) throw new LiveToolError('No question is shown.')
    return q
  }
  function findTimer(ref: string): Timer {
    const timers = api.timers()
    const key = ref.trim().toLowerCase()
    const t = timers.find(t => t.id === ref) ?? timers.find(t => t.label.toLowerCase() === key)
    if (!t) throw new LiveToolError(`No timer "${ref}". Call get_question for the timers.`)
    return t
  }

  return toWebMcpSet(
    [
      tool({
        name: 'get_question',
        description:
          'The question shown: its round, position, text, options and correct answer, whether it is ruled or revealed, its buzzes, and the game’s timers.',
        input: NO_ARGS,
        read: true,
        run: () => ({
          question: shown(),
          buzzes: api.buzzes(),
          timers: api.timers().map(t => ({
            id: t.id,
            label: t.label,
            seconds: Math.ceil(timerRemaining(t)),
            running: !t.paused && t.startedAt !== null,
          })),
        }),
      }),
      tool({
        name: 'next_question',
        description:
          'Move to the next question, or to the round’s review or scoreboard when the game has those steps.',
        input: NO_ARGS,
        run: async () => {
          shown()
          return (await api.next())
            ? 'Moved on. Call get_question to see where.'
            : 'The question has no ruling yet, so the host was asked to confirm leaving it.'
        },
      }),
      tool({
        name: 'previous_question',
        description: 'Go back to the previous question.',
        input: NO_ARGS,
        run: async () => {
          if (shown().number <= 1) throw new LiveToolError('This is the first question.')
          await api.previous()
          return 'Went back.'
        },
      }),
      tool({
        name: 'set_buzzer',
        description: 'Lock or unlock the players’ buzzers.',
        input: z.object({ locked: z.boolean() }),
        run: async ({ locked }) => {
          await api.setBuzzerLocked(locked)
          return locked ? 'Buzzer locked.' : 'Buzzer unlocked.'
        },
      }),
      tool({
        name: 'rule_buzz',
        description:
          'Rule on a buzz from get_question. Correct awards the question’s points and ends the question.',
        input: z.object({
          buzz: z.string().min(1).describe('The buzz id'),
          ruling: z.enum(['correct', 'incorrect', 'skip']),
        }),
        run: async ({ buzz, ruling }) => {
          shown()
          const b = api.buzzes().find(b => b.id === buzz)
          if (!b) throw new LiveToolError(`No buzz "${buzz}" on this question.`)
          if (b.decision) throw new LiveToolError(`${b.player}'s buzz is already ruled.`)
          await api.ruleBuzz(b.id, DECISIONS[ruling])
          return `Ruled ${b.player}: ${ruling}.`
        },
      }),
      tool({
        name: 'rule_question',
        description:
          'Rule on the question without a buzz. A correct ruling may award its points to a player or team by name or id.',
        input: z.object({
          ruling: z.enum(['correct', 'incorrect', 'skipped']),
          award: z.string().optional().describe('Who gets the points, for a correct ruling'),
        }),
        run: async ({ ruling, award }) => {
          if (shown().status !== 'pending') throw new LiveToolError('This question is ruled.')
          let to: RulingAward | null = null
          if (award && ruling === 'correct') {
            const team = api
              .teams()
              .find(t => t.id === award || t.name.toLowerCase() === award.trim().toLowerCase())
            to = team
              ? { kind: 'team', id: team.id }
              : { kind: 'player', id: findPlayer(api.players(), award).id }
          }
          await api.rule(ruling, to)
          return `Ruled the question ${ruling}.`
        },
      }),
      tool({
        name: 'mark_answers',
        description:
          'Close the question to new answers and mark the players’ choices against the correct answer.',
        input: NO_ARGS,
        run: async () => {
          shown()
          if (!api.takesAnswers()) throw new LiveToolError('Players don’t answer on their phones.')
          await api.markAnswers()
          return 'Marked.'
        },
      }),
      tool({
        name: 'reveal_answer',
        description: 'Show the correct answer to players and screens.',
        input: NO_ARGS,
        run: async () => {
          if (shown().revealed) throw new LiveToolError('The answer is already shown.')
          await api.reveal()
          return 'Revealed.'
        },
      }),
      tool({
        name: 'control_timer',
        description: 'Start, pause, resume or restart one of the game’s timers, by id or label.',
        input: z.object({
          timer: z.string().min(1),
          action: z.enum(['start', 'pause', 'resume', 'restart']),
        }),
        run: async ({ timer, action }) => {
          const t = findTimer(timer)
          await api.timer(t.id, action)
          return `${TIMER_DONE[action]} ${t.label}.`
        },
      }),
    ],
    limiter
  )
}
