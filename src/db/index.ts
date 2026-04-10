import Dexie, { type EntityTable } from 'dexie'

// ── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended'
export type Difficulty = 'easy' | 'medium' | 'hard' | string
export type GameStatus = 'waiting' | 'active' | 'paused' | 'ended'
export type TransportMode = 'auto' | 'peer' | 'gun'
export type GmDecision = 'Correct' | 'Incorrect' | 'Skip'
export type BuzzDeduplication = 'firstOnly' | 'all'
export type TiebreakerMode = 'serverOrder'
export type WidgetType =
  | 'buzzer'
  | 'question'
  | 'answers'
  | 'media'
  | 'timer'
  | 'buzz_order'
  | 'scoreboard'
  | 'leaderboard'
  | 'player_list'
  | 'round_info'
  | 'text'
  | 'qr_code'
  | 'announcement'
  | 'image'
  | 'game_controls'
  | 'progress'

export interface DifficultyLevel {
  id: string
  name: string
  score: number
  color: string
  order: number
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Question {
  id: string
  title: string
  type: QuestionType
  options: string[] // multiple_choice: 4 items; true_false: ['True','False']
  answer: string // correct answer
  description: string // markdown
  difficulty: string | null
  tags: string[]
  media: string | null // base64 or URL
  mediaType: 'image' | 'audio' | 'video' | null
  createdAt: number
  updatedAt: number
}

export interface Round {
  id: string
  name: string
  description: string
  questionIds: string[] // ordered
  createdAt: number
}

export interface Game {
  id: string
  name: string
  status: GameStatus
  transportMode: TransportMode
  roomId: string | null
  passphrase: string | null // Gun.js SEA encryption
  // Visibility
  showQuestion: boolean
  showAnswers: boolean
  showMedia: boolean
  // Players / teams
  maxTeams: number // 0 = unlimited
  maxPerTeam: number // 0 = unlimited
  allowIndividual: boolean
  // Rounds / navigation
  roundIds: string[]
  currentRoundIdx: number
  currentQuestionIdx: number
  // Buzzer state
  buzzerLocked: boolean
  // Buzzer configuration
  scoringEnabled: boolean
  autoLockOnFirstCorrect: boolean
  allowFalseStarts: boolean
  buzzDeduplication: BuzzDeduplication
  tiebreakerMode: TiebreakerMode
  // Timestamps
  createdAt: number
  updatedAt: number
}

export interface Team {
  id: string
  gameId: string
  name: string
  color: string
  score: number
}

export interface Player {
  id: string
  gameId: string
  name: string
  teamId: string | null
  score: number
  isAway: boolean
  deviceId: string
  joinedAt: number
}

export interface BuzzEvent {
  id: string
  gameId: string
  questionId: string
  playerId: string
  playerName: string
  teamId: string | null
  /** microsecond precision via performance.now() offset from Date.now() */
  timestamp: number
  /** true when buzz arrived before buzzerLocked was cleared */
  isFalseStart: boolean
  gmDecision: GmDecision | null
  decidedAt: number | null
}

export interface Layout {
  id: string
  gameId: string | null // null = global template
  name: string
  target: 'admin' | 'player'
  isActive: boolean
  order: number
}

export interface Widget {
  id: string
  layoutId: string
  type: WidgetType
  config: Record<string, unknown>
  width: 'full' | 'half'
  order: number
}

export interface Note {
  id: string
  name: string
  content: string // markdown
  createdAt: number
  updatedAt: number
}

export type TimerNotify = 'none' | 'host' | 'players' | 'both'
export type TimerAutoReset = 'none' | 'question' | 'round' | 'any'

export interface Timer {
  id: string
  gameId: string
  label: string
  duration: number // seconds
  remaining: number
  target: 'all' | 'admin' | string // teamId or playerId
  message: string
  visible: boolean
  paused: boolean
  startedAt: number | null
  /** Who hears the audio beep when the timer hits zero */
  audioNotify: TimerNotify
  /** Who sees the visual popup when the timer hits zero */
  visualNotify: TimerNotify
  /** Which navigation event auto-resets (pauses + restores remaining) this timer */
  autoReset: TimerAutoReset
}

export interface GameQuestion {
  id: string
  gameId: string
  questionId: string
  roundId: string
  order: number
  status: 'pending' | 'correct' | 'incorrect' | 'skipped'
}

// ── Database ─────────────────────────────────────────────────────────────────

class ViktoraniDB extends Dexie {
  difficulties!: EntityTable<DifficultyLevel, 'id'>
  tags!: EntityTable<Tag, 'id'>
  questions!: EntityTable<Question, 'id'>
  rounds!: EntityTable<Round, 'id'>
  games!: EntityTable<Game, 'id'>
  teams!: EntityTable<Team, 'id'>
  players!: EntityTable<Player, 'id'>
  buzzEvents!: EntityTable<BuzzEvent, 'id'>
  layouts!: EntityTable<Layout, 'id'>
  widgets!: EntityTable<Widget, 'id'>
  notes!: EntityTable<Note, 'id'>
  timers!: EntityTable<Timer, 'id'>
  gameQuestions!: EntityTable<GameQuestion, 'id'>

  constructor() {
    super('viktorani')

    this.version(2).stores({
      categories: 'id, name',
      difficulties: 'id, name, order',
      tags: 'id, name',
      questions: 'id, categoryId, difficulty, type, createdAt',
      rounds: 'id, createdAt',
      games: 'id, status, createdAt',
      teams: 'id, gameId',
      players: 'id, gameId, teamId, deviceId',
      buzzEvents: 'id, gameId, playerId, questionId, timestamp',
      layouts: 'id, gameId, target',
      widgets: 'id, layoutId, order',
      notes: 'id, name, createdAt, updatedAt',
      timers: 'id, gameId',
      gameQuestions: 'id, gameId, roundId, order',
    })

    // v3: drop categories table; remove categoryId index from questions
    this.version(3)
      .stores({
        categories: null, // drop table
        difficulties: 'id, name, order',
        tags: 'id, name',
        questions: 'id, difficulty, type, createdAt',
        rounds: 'id, createdAt',
        games: 'id, status, createdAt',
        teams: 'id, gameId',
        players: 'id, gameId, teamId, deviceId',
        buzzEvents: 'id, gameId, playerId, questionId, timestamp',
        layouts: 'id, gameId, target',
        widgets: 'id, layoutId, order',
        notes: 'id, name, createdAt, updatedAt',
        timers: 'id, gameId',
        gameQuestions: 'id, gameId, roundId, order',
      })
      .upgrade(tx => {
        return tx
          .table('questions')
          .toCollection()
          .modify((q: Record<string, unknown>) => {
            delete q['categoryId']
          })
      })

    // v4: full BuzzEvent schema + buzzer config back-fill on Game records
    this.version(4)
      .stores({
        difficulties: 'id, name, order',
        tags: 'id, name',
        questions: 'id, difficulty, type, createdAt',
        rounds: 'id, createdAt',
        games: 'id, status, createdAt',
        teams: 'id, gameId',
        players: 'id, gameId, teamId, deviceId',
        buzzEvents: 'id, gameId, playerId, questionId, timestamp',
        layouts: 'id, gameId, target',
        widgets: 'id, layoutId, order',
        notes: 'id, name, createdAt, updatedAt',
        timers: 'id, gameId',
        gameQuestions: 'id, gameId, roundId, order',
      })
      .upgrade(async tx => {
        await tx
          .table('games')
          .toCollection()
          .modify((g: Record<string, unknown>) => {
            if (g['autoLockOnFirstCorrect'] === undefined) g['autoLockOnFirstCorrect'] = false
            if (g['allowFalseStarts'] === undefined) g['allowFalseStarts'] = false
            if (g['buzzDeduplication'] === undefined) g['buzzDeduplication'] = 'firstOnly'
            if (g['tiebreakerMode'] === undefined) g['tiebreakerMode'] = 'serverOrder'
          })
        await tx
          .table('buzzEvents')
          .toCollection()
          .modify((b: Record<string, unknown>) => {
            if (b['playerName'] === undefined) b['playerName'] = 'Unknown'
            if (b['teamId'] === undefined) b['teamId'] = null
            if (b['isFalseStart'] === undefined) b['isFalseStart'] = false
            if (b['gmDecision'] === undefined) b['gmDecision'] = null
            if (b['decidedAt'] === undefined) b['decidedAt'] = null
          })
      })

    // v5: add audioNotify, visualNotify, autoReset to timers
    this.version(5)
      .stores({
        difficulties: 'id, name, order',
        tags: 'id, name',
        questions: 'id, difficulty, type, createdAt',
        rounds: 'id, createdAt',
        games: 'id, status, createdAt',
        teams: 'id, gameId',
        players: 'id, gameId, teamId, deviceId',
        buzzEvents: 'id, gameId, playerId, questionId, timestamp',
        layouts: 'id, gameId, target',
        widgets: 'id, layoutId, order',
        notes: 'id, name, createdAt, updatedAt',
        timers: 'id, gameId',
        gameQuestions: 'id, gameId, roundId, order',
      })
      .upgrade(async tx => {
        await tx
          .table('timers')
          .toCollection()
          .modify((t: Record<string, unknown>) => {
            if (t['audioNotify'] === undefined) t['audioNotify'] = 'none'
            if (t['visualNotify'] === undefined) t['visualNotify'] = 'none'
            if (t['autoReset'] === undefined) t['autoReset'] = 'none'
          })
      })
  }
}

export const db = new ViktoraniDB()

// ── Seed defaults ─────────────────────────────────────────────────────────────

let _seeding = false

export async function seedDefaults() {
  // Guard against concurrent calls (e.g. StrictMode double-invoke)
  if (_seeding) return
  _seeding = true
  try {
    const [diffCount, tagCount] = await Promise.all([db.difficulties.count(), db.tags.count()])

    await db.transaction('rw', [db.difficulties, db.tags], async () => {
      if (diffCount === 0) {
        await db.difficulties.bulkAdd([
          { id: crypto.randomUUID(), name: 'Easy', score: 5, color: '#27ae60', order: 0 },
          { id: crypto.randomUUID(), name: 'Medium', score: 10, color: '#e67e22', order: 1 },
          { id: crypto.randomUUID(), name: 'Hard', score: 15, color: '#c0392b', order: 2 },
        ])
      }

      if (tagCount === 0) {
        await db.tags.bulkAdd([
          { id: crypto.randomUUID(), name: 'Pop Culture', color: '#9b59b6' },
          { id: crypto.randomUUID(), name: 'History', color: '#e67e22' },
          { id: crypto.randomUUID(), name: 'Sports', color: '#27ae60' },
          { id: crypto.randomUUID(), name: 'Science', color: '#2980b9' },
          { id: crypto.randomUUID(), name: 'Geography', color: '#16a085' },
          { id: crypto.randomUUID(), name: 'Music', color: '#8e44ad' },
          { id: crypto.randomUUID(), name: 'Movies', color: '#c0392b' },
          { id: crypto.randomUUID(), name: 'Literature', color: '#c9a84c' },
        ])
      }
    })
  } finally {
    _seeding = false
  }
}

export async function purgeDatabase(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.difficulties,
      db.tags,
      db.questions,
      db.rounds,
      db.games,
      db.teams,
      db.players,
      db.buzzEvents,
      db.layouts,
      db.widgets,
      db.notes,
      db.timers,
      db.gameQuestions,
    ],
    async () => {
      await Promise.all([
        db.difficulties.clear(),
        db.tags.clear(),
        db.questions.clear(),
        db.rounds.clear(),
        db.games.clear(),
        db.teams.clear(),
        db.players.clear(),
        db.buzzEvents.clear(),
        db.layouts.clear(),
        db.widgets.clear(),
        db.notes.clear(),
        db.timers.clear(),
        db.gameQuestions.clear(),
      ])
    }
  )
}
