import Dexie, { type EntityTable } from 'dexie'

// ── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended'
export type Difficulty = 'easy' | 'medium' | 'hard' | string
export type GameStatus = 'waiting' | 'active' | 'paused' | 'ended'
export type TransportMode = 'auto' | 'peer' | 'gun'
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

export interface Category {
  id: string
  name: string
  color: string
}

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
  categoryId: string | null
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
  scoringEnabled: boolean
  showQuestion: boolean
  showAnswers: boolean
  showMedia: boolean
  maxTeams: number // 0 = unlimited
  maxPerTeam: number // 0 = unlimited
  allowIndividual: boolean
  roundIds: string[]
  currentRoundIdx: number
  currentQuestionIdx: number
  buzzerLocked: boolean
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
  playerId: string
  questionId: string
  timestamp: number // microsecond precision
  correct: boolean | null
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
  categories!: EntityTable<Category, 'id'>
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
  }
}

export const db = new ViktoraniDB()

// ── Seed defaults ─────────────────────────────────────────────────────────────

export async function seedDefaults() {
  const diffCount = await db.difficulties.count()
  if (diffCount > 0) return

  await db.difficulties.bulkAdd([
    { id: crypto.randomUUID(), name: 'Easy', score: 5, color: '#27ae60', order: 0 },
    { id: crypto.randomUUID(), name: 'Medium', score: 10, color: '#e67e22', order: 1 },
    { id: crypto.randomUUID(), name: 'Hard', score: 15, color: '#c0392b', order: 2 },
  ])

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
