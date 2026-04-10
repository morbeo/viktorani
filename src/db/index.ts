import Dexie, { type EntityTable } from 'dexie'

// ── Types ────────────────────────────────────────────────────────────────────

/** The three structural question formats supported by the question bank. */
export type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended'

/**
 * Difficulty level identifier — either one of the built-in slugs or
 * a custom string defined in the Difficulties settings panel.
 */
export type Difficulty = 'easy' | 'medium' | 'hard' | string

/** Lifecycle state of a {@link Game} session. */
export type GameStatus = 'waiting' | 'active' | 'paused' | 'ended'

/** Which underlying transport a game uses for real-time communication. */
export type TransportMode = 'auto' | 'peer' | 'gun'

/** The GameMaster's ruling on a single buzz. */
export type GmDecision = 'Correct' | 'Incorrect' | 'Skip'

/**
 * Controls whether only the first buzz per player per question is shown,
 * or all buzzes (including subsequent ones) are recorded.
 */
export type BuzzDeduplication = 'firstOnly' | 'all'

/**
 * Who receives an audio beep when a timer expires.
 * `'none'` — no audio; `'host'` — GM only; `'players'` — players only; `'both'` — everyone.
 */
export type TimerNotify = 'none' | 'host' | 'players' | 'both'

/**
 * When (if ever) a timer resets automatically to its full duration.
 * `'none'` — never; `'question'` — on question change; `'round'` — on round change; `'any'` — on either.
 */
export type TimerAutoReset = 'none' | 'question' | 'round' | 'any'

/**
 * Strategy for breaking ties when two buzzes arrive with identical timestamps.
 * Currently only server-arrival order is supported.
 */
export type TiebreakerMode = 'serverOrder'

/**
 * The set of widget types that can be placed in a GM layout.
 * Each type maps to a distinct React component in the GameMaster screen.
 */
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

/**
 * A configurable difficulty tier with a point value and display colour.
 * Stored in the `difficulties` collection; seeded with Easy / Medium / Hard on first run.
 */
export interface DifficultyLevel {
  id: string
  name: string
  /** Points awarded when a player answers a question at this difficulty correctly. */
  score: number
  /** CSS hex colour used in the UI (e.g. `'#27ae60'`). */
  color: string
  /** Zero-based display order in lists and dropdowns. */
  order: number
}

/**
 * A question classifier. Tags replace the legacy category system (see ADR-0007).
 * A question can have zero or more tags; filtering is tri-state per tag.
 */
export interface Tag {
  id: string
  name: string
  /** CSS hex colour for the tag pill (e.g. `'#9b59b6'`). */
  color: string
}

/**
 * A single trivia question in the question bank.
 *
 * @remarks
 * - `type === 'multiple_choice'`: `options` holds exactly 4 strings; `answer` is one of them.
 * - `type === 'true_false'`: `options` is `['True', 'False']`; `answer` is one of them.
 * - `type === 'open_ended'`: `options` is empty; `answer` is the canonical correct answer.
 */
export interface Question {
  id: string
  title: string
  type: QuestionType
  /** Possible answers shown to players (MC and T/F only). */
  options: string[]
  /** The canonical correct answer string. */
  answer: string
  /** Optional markdown body shown below the question title. */
  description: string
  /** ID of the associated {@link DifficultyLevel}, or `null` if unset. */
  difficulty: string | null
  /** Array of {@link Tag} IDs. */
  tags: string[]
  /** Base64-encoded media data or a remote URL, or `null` if none. */
  media: string | null
  mediaType: 'image' | 'audio' | 'video' | null
  createdAt: number
  updatedAt: number
}

/**
 * An ordered collection of questions that forms one section of a {@link Game}.
 */
export interface Round {
  id: string
  name: string
  description: string
  /** Ordered array of {@link Question} IDs. */
  questionIds: string[]
  createdAt: number
}

/**
 * A complete game session including configuration, real-time state, and navigation position.
 *
 * @remarks
 * The `buzzerLocked` flag and `showQuestion / showAnswers / showMedia` fields are
 * the authoritative source of truth for the current question's display state.
 * They are synced to players via transport events (`BUZZER_LOCK`, `VISIBILITY`, etc.)
 * whenever the GM changes them.
 */
export interface Game {
  id: string
  name: string
  status: GameStatus
  transportMode: TransportMode
  /** Six-character room code shared with players (e.g. `'XK7RQZ'`). `null` before the game starts. */
  roomId: string | null
  /** Four-word Gun.js SEA passphrase. `null` before the game starts. */
  passphrase: string | null
  // Visibility
  showQuestion: boolean
  showAnswers: boolean
  showMedia: boolean
  // Players / teams
  /** Maximum number of teams allowed; `0` means unlimited. */
  maxTeams: number
  /** Maximum players per team; `0` means unlimited. */
  maxPerTeam: number
  allowIndividual: boolean
  // Rounds / navigation
  /** Ordered array of {@link Round} IDs. */
  roundIds: string[]
  currentRoundIdx: number
  currentQuestionIdx: number
  // Buzzer state
  buzzerLocked: boolean
  // Buzzer configuration
  scoringEnabled: boolean
  /** Lock the buzzer automatically after the first correct adjudication. */
  autoLockOnFirstCorrect: boolean
  /** Whether false-start buzzes (arriving while locked) are recorded. */
  allowFalseStarts: boolean
  buzzDeduplication: BuzzDeduplication
  tiebreakerMode: TiebreakerMode
  // Timestamps
  createdAt: number
  updatedAt: number
}

/** A team of players within a {@link Game}. Scores are aggregated from member players. */
export interface Team {
  id: string
  gameId: string
  name: string
  color: string
  score: number
}

/** A player connected to a {@link Game} session. */
export interface Player {
  id: string
  gameId: string
  name: string
  /** `null` if the player is not on a team (individual mode). */
  teamId: string | null
  score: number
  /** `true` when the player's tab is backgrounded (detected via Page Visibility API). */
  isAway: boolean
  /** Stable browser-local UUID stored in `localStorage` to deduplicate rejoins. */
  deviceId: string
  joinedAt: number
}

/**
 * A single buzz event recorded during a question.
 *
 * @remarks
 * `timestamp` uses `performance.now()` offset from `Date.now()` at session start
 * to provide sub-millisecond precision for ordering simultaneous buzzes.
 * `isFalseStart` is set when the buzz arrived while `buzzerLocked` was `true`.
 */
export interface BuzzEvent {
  id: string
  gameId: string
  questionId: string
  playerId: string
  playerName: string
  teamId: string | null
  /** High-precision client-side timestamp for ordering (microseconds). */
  timestamp: number
  /** `true` when the buzz arrived before the GM unlocked the buzzer. */
  isFalseStart: boolean
  gmDecision: GmDecision | null
  decidedAt: number | null
}

/**
 * A named arrangement of {@link Widget}s displayed on the GM screen.
 *
 * @remarks
 * `gameId === null` indicates a global reusable template.
 * `isActive` marks which layout is currently shown in the GM view.
 * The four default layouts correspond to game phases: lobby, active question,
 * scoreboard, and results.
 */
export interface Layout {
  id: string
  /** `null` for global templates not tied to a specific game. */
  gameId: string | null
  name: string
  target: 'admin' | 'player'
  isActive: boolean
  /** Display order within the layout switcher. */
  order: number
}

/**
 * A single panel within a {@link Layout}.
 * `config` is an opaque object whose shape depends on `type`.
 */
export interface Widget {
  id: string
  layoutId: string
  type: WidgetType
  config: Record<string, unknown>
  width: 'full' | 'half'
  /** Display order within the layout grid. */
  order: number
}

/** A freeform markdown note for the GameMaster's use (e.g. round intros, hints). */
export interface Note {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

/**
 * A countdown timer that can be broadcast to players.
 *
 * @remarks
 * `target === 'all'` broadcasts to everyone; `'admin'` shows only on the GM screen;
 * a team or player ID restricts visibility to that entity.
 */
export interface Timer {
  id: string
  gameId: string
  label: string
  /** Total duration in seconds. */
  duration: number
  /** Remaining seconds at the last pause/update. */
  remaining: number
  target: 'all' | 'admin' | string
  message: string
  visible: boolean
  paused: boolean
  /** `Date.now()` value when the timer last started (or `null` if not yet started). */
  startedAt: number | null
  /** Who hears the audio beep on expiry. */
  audioNotify: TimerNotify
  /** Who sees the visual flash on expiry. */
  visualNotify: TimerNotify
  /** Whether and when the timer resets automatically. */
  autoReset: TimerAutoReset
}

/**
 * Tracks the GM's adjudication status for each question in a game.
 * Created when a question is first visited; updated as the GM rules on buzzes.
 */
export interface GameQuestion {
  id: string
  gameId: string
  questionId: string
  roundId: string
  /** Position within the round (zero-based). */
  order: number
  status: 'pending' | 'correct' | 'incorrect' | 'skipped'
}

// ── Database ─────────────────────────────────────────────────────────────────

/**
 * Main Dexie database class. Exported as the {@link db} singleton.
 *
 * Schema versions:
 * - **v2**: Initial schema with `categories` table and `categoryId` on questions.
 * - **v3**: Drop `categories`; remove `categoryId` index (ADR-0007).
 * - **v4**: Full `BuzzEvent` schema + buzzer-config back-fill on `Game` records.
 */
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
  }
}

/** Module-level singleton. Import and use this in all hooks and pages. */
export const db = new ViktoraniDB()

// ── Seed defaults ─────────────────────────────────────────────────────────────

let _seeding = false

/**
 * Populate the database with default difficulty levels and tags on first run.
 *
 * @remarks
 * Guarded against concurrent invocations (e.g. React StrictMode double-invoke)
 * via the `_seeding` flag. Safe to call multiple times — it is a no-op after
 * the first successful seed.
 */
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

/**
 * Permanently delete all data from every collection.
 *
 * @remarks
 * Runs inside a single Dexie transaction so the wipe is atomic.
 * Called from the Settings page after a two-step confirmation.
 */
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
