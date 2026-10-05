import Dexie, { type EntityTable } from 'dexie'
import type { ManagedPlayer, ManagedTeam, ManagedLabel } from '@/types/players-teams'
export type { ManagedPlayer, ManagedTeam, ManagedLabel } from '@/types/players-teams'

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
 * Where a player stands with the host.
 * `'connected'` — playing; `'hidden'` — connected, but their tab is in the background;
 * `'disconnected'` — no connection (it dropped, or they never joined from a device);
 * `'left'` — they pressed Leave; `'kicked'` — the host removed them.
 */
export type PlayerPresence = 'connected' | 'hidden' | 'disconnected' | 'left' | 'kicked'

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

/** Which parts of the current question one target (phones or screen) shows. */
export interface TargetVisibility {
  showQuestion: boolean
  showAnswers: boolean
  showMedia: boolean
}

/** Question visibility, set independently for player phones and the projector screen. */
export interface GameVisibility {
  players: TargetVisibility
  screen: TargetVisibility
}

/**
 * A complete game session including configuration, real-time state, and navigation position.
 *
 * @remarks
 * The `buzzerLocked` flag and `visibility` are
 * the authoritative source of truth for the current question's display state.
 * They are synced to players via transport events (`BUZZER_LOCK`, `VISIBILITY`, etc.)
 * whenever the GM changes them.
 */
export interface Game {
  id: string
  name: string
  status: GameStatus
  /** Six-character room code shared with players (e.g. `'XK7RQZ'`). `null` before the game starts. */
  roomId: string | null
  visibility: GameVisibility
  // Players / teams
  /** Maximum number of teams allowed; `0` means unlimited. */
  maxTeams: number
  /** Maximum players per team; `0` means unlimited. */
  maxPerTeam: number
  /** Maximum total players in the game, teamed or not; `0` means unlimited. */
  maxPlayers: number
  allowIndividual: boolean
  // Join policy (the GM can change these mid-game)
  /** Players may join after the game has started. */
  allowLateJoin: boolean
  /** A known device may rejoin as its existing player after leaving or disconnecting. */
  allowRejoin: boolean
  /** Seconds a disconnected device has to rejoin as the same player; `0` means no limit. */
  rejoinWindowSeconds: number
  /** New players wait in the lobby until the GM accepts them. */
  requireApproval: boolean
  /** Players may create their own team when joining. */
  allowPlayerTeams: boolean
  // Rounds / navigation
  /** Ordered array of {@link Round} IDs. */
  roundIds: string[]
  currentRoundIdx: number
  currentQuestionIdx: number
  // Buzzer state
  buzzerLocked: boolean
  // Buzzer configuration
  scoringEnabled: boolean
  /** Whether this game has a buzzer at all. Off for host-paced formats with no buzzing. */
  buzzerEnabled: boolean
  /** Lock the buzzer automatically after the first correct adjudication. */
  autoLockOnFirstCorrect: boolean
  /** Whether false-start buzzes (arriving while locked) are recorded. */
  allowFalseStarts: boolean
  buzzDeduplication: BuzzDeduplication
  tiebreakerMode: TiebreakerMode
  /** Ask for confirmation before leaving a question with no ruling (`pending`). */
  confirmUnruledNavigation: boolean
  // Timer defaults
  /** Start a timer automatically whenever a question is shown. */
  autoStartTimerOnQuestionShow: boolean
  /** Seconds a new auto-started timer runs for. */
  defaultTimerDuration: number
  // Sound
  soundEffectsMuted: boolean
  // Timestamps
  createdAt: number
  updatedAt: number
}

/** A team of players within a {@link Game}. Its score is stored separately from its members' scores. */
export interface Team {
  id: string
  gameId: string
  name: string
  color: string
  /** Lucide icon key (e.g. 'Zap', 'Shield'). Defaults to 'Shield' if not set. */
  icon: string
  score: number
  /** Free-text notes for the host's own use (e.g. a running bonus, a house rule). */
  notes: string
}

/** A player connected to a {@link Game} session. */
export interface Player {
  id: string
  gameId: string
  name: string
  /** `null` if the player is not on a team (individual mode). */
  teamId: string | null
  score: number
  /** Connection state as the host sees it; see {@link PlayerPresence}. */
  presence: PlayerPresence
  /** Epoch ms the player was last marked disconnected or left, or `null`. Used for the rejoin window. */
  disconnectedAt: number | null
  /** Stable browser-local UUID stored in `localStorage` to deduplicate rejoins. */
  deviceId: string
  joinedAt: number
  /** Free-text notes for the host's own use, scoped to this game. */
  notes: string
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
  /** Time reported by the player's device. Its clock may be skewed, so it never decides order. */
  timestamp: number
  /** Host clock (epoch ms, sub-ms precision) when the buzz arrived; buzzes are ordered by this. */
  receivedAt: number
  /** `true` when the buzz arrived before the GM unlocked the buzzer. */
  isFalseStart: boolean
  gmDecision: GmDecision | null
  decidedAt: number | null
}

/** Why a score changed: a ± step, a value typed in, or a correct answer. */
export type ScoreChangeReason = 'step' | 'set' | 'correct'

/** One change to a player's or team's score; together they are a game's score history. */
export interface ScoreEvent {
  id: string
  gameId: string
  /** The player or team whose score changed. */
  targetId: string
  kind: 'player' | 'team'
  /** The player's or team's name at the time of the change. */
  name: string
  from: number
  to: number
  reason: ScoreChangeReason
  /** The question being played, or `null` when none was. */
  questionId: string | null
  timestamp: number
}

/** Something that happened in a game, other than buzzes and score changes. */
export type GameLogKind =
  | 'game_started'
  | 'game_paused'
  | 'game_resumed'
  | 'game_ended'
  | 'question_shown'
  | 'round_changed'
  | 'player_joined'
  | 'player_rejoined'
  | 'join_approved'
  | 'join_rejected'
  | 'player_hidden'
  | 'player_back'
  | 'player_disconnected'
  | 'player_left'
  | 'player_kicked'
  | 'team_created'
  | 'buzzer_locked'
  | 'buzzer_unlocked'
  | 'buzzes_cleared'
  | 'timer_started'
  | 'timer_paused'
  | 'timer_resumed'
  | 'timer_reset'
  | 'timer_expired'
  | 'visibility_changed'
  | 'screen_approved'
  | 'screen_rejected'
  | 'screen_disconnected'
  | 'message_sent'
  | 'device_mismatch'

/**
 * One entry in a game's log. Buzzes, rulings and score changes are not copied here: the
 * log view reads them from `buzzEvents` and `scoreEvents`.
 */
export interface GameLogEntry {
  id: string
  gameId: string
  /** `Date.now()` when it happened. */
  at: number
  kind: GameLogKind
  /** The player who did it, or `null` for the host. */
  actorId: string | null
  /** The player, team, timer or question it happened to, if any. */
  subjectId: string | null
  /** Details for display, such as names at the time. */
  data: Record<string, string | number | boolean | null>
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
  /** Zero-based position across all rounds of the game. */
  order: number
  status: 'pending' | 'correct' | 'incorrect' | 'skipped'
}

// ── Database ─────────────────────────────────────────────────────────────────

/**
 * Main Dexie database class. Exported as the {@link db} singleton.
 *
 * Schema version history — RULE: the number passed to `this.version()` only ever increases.
 * Never lower it or reuse an old number, even when collapsing history: browsers keep the
 * highest version they have seen, and a lower declared version cannot run upgrades on them.
 *
 * - 1–4: early development (tables added, `categories` dropped, buzzer fields back-filled).
 * - 5: current schema. Stores match the collapsed v1 schema; the bump moves past the v4
 *   that was deployed before history was collapsed back to 1. Dexie reads the installed
 *   schema from IndexedDB, so a v1 or v4 database upgrades in place (missing tables are
 *   created) without declaring the older versions here.
 * - 6: same stores; back-fills the join policy fields on existing games.
 * - 7: same stores; moves `showQuestion / showAnswers / showMedia` into per-target `visibility`.
 * - 8: same stores; replaces `Player.isAway` with `Player.presence`.
 * - 9: adds `scoreEvents`, the log of score changes.
 * - 10: adds `gameLog`, the log of everything else that happens in a game.
 * - 11: same stores; back-fills `Game.buzzerEnabled` (`true`) on existing games.
 * - 12: same stores; back-fills `Team.notes` (`''`) on existing teams.
 * - 13: same stores; back-fills `Player.notes` (`''`) on existing players.
 * - 14: same stores; back-fills `Game.maxPlayers` (`0`, unlimited) on existing games.
 * - 15: same stores; back-fills `Game.soundEffectsMuted` (`false`), `Game.confirmUnruledNavigation`
 *   (`false`), `Game.autoStartTimerOnQuestionShow` (`false`), `Game.defaultTimerDuration` (`60`)
 *   and `Game.rejoinWindowSeconds` (`0`, unlimited) on existing games, and `Player.disconnectedAt`
 *   (`null`) on existing players.
 *
 * To change the schema, add a new `this.version(N + 1)` block below; keep existing blocks.
 */
export class ViktoraniDB extends Dexie {
  difficulties!: EntityTable<DifficultyLevel, 'id'>
  tags!: EntityTable<Tag, 'id'>
  questions!: EntityTable<Question, 'id'>
  rounds!: EntityTable<Round, 'id'>
  games!: EntityTable<Game, 'id'>
  teams!: EntityTable<Team, 'id'>
  players!: EntityTable<Player, 'id'>
  buzzEvents!: EntityTable<BuzzEvent, 'id'>
  scoreEvents!: EntityTable<ScoreEvent, 'id'>
  gameLog!: EntityTable<GameLogEntry, 'id'>
  layouts!: EntityTable<Layout, 'id'>
  widgets!: EntityTable<Widget, 'id'>
  notes!: EntityTable<Note, 'id'>
  timers!: EntityTable<Timer, 'id'>
  gameQuestions!: EntityTable<GameQuestion, 'id'>
  managedPlayers!: EntityTable<ManagedPlayer, 'id'>
  managedTeams!: EntityTable<ManagedTeam, 'id'>
  managedLabels!: EntityTable<ManagedLabel, 'id'>

  constructor() {
    super('viktorani')

    this.version(5).stores({
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
      managedPlayers: 'id, name, archivedAt',
      managedTeams: 'id, name, archivedAt',
      managedLabels: 'id, name',
    })

    this.version(6)
      .stores({})
      .upgrade(tx =>
        tx
          .table('games')
          .toCollection()
          .modify((g: Partial<Game>) => {
            g.allowLateJoin ??= true
            g.allowRejoin ??= true
            g.requireApproval ??= false
            g.allowPlayerTeams ??= true
          })
      )

    this.version(7)
      .stores({})
      .upgrade(tx =>
        tx
          .table('games')
          .toCollection()
          .modify((g: Partial<Game> & Partial<TargetVisibility>) => {
            const flags: TargetVisibility = {
              showQuestion: g.showQuestion ?? true,
              showAnswers: g.showAnswers ?? false,
              showMedia: g.showMedia ?? true,
            }
            g.visibility ??= { players: { ...flags }, screen: { ...flags } }
            delete g.showQuestion
            delete g.showAnswers
            delete g.showMedia
          })
      )

    // Player.isAway became Player.presence. An away player may have left, been kicked or
    // dropped; without knowing which, they are treated as disconnected.
    this.version(8)
      .stores({})
      .upgrade(tx =>
        tx
          .table('players')
          .toCollection()
          .modify((p: Partial<Player> & { isAway?: boolean }) => {
            p.presence ??= p.isAway ? 'disconnected' : 'connected'
            delete p.isAway
          })
      )

    this.version(9).stores({ scoreEvents: 'id, gameId, timestamp' })

    this.version(10).stores({ gameLog: 'id, gameId, [gameId+at]' })

    this.version(11)
      .stores({})
      .upgrade(tx =>
        tx
          .table('games')
          .toCollection()
          .modify((g: Partial<Game>) => {
            g.buzzerEnabled ??= true
          })
      )

    this.version(12)
      .stores({})
      .upgrade(tx =>
        tx
          .table('teams')
          .toCollection()
          .modify((t: Partial<Team>) => {
            t.notes ??= ''
          })
      )

    this.version(13)
      .stores({})
      .upgrade(tx =>
        tx
          .table('players')
          .toCollection()
          .modify((p: Partial<Player>) => {
            p.notes ??= ''
          })
      )

    this.version(14)
      .stores({})
      .upgrade(tx =>
        tx
          .table('games')
          .toCollection()
          .modify((g: Partial<Game>) => {
            g.maxPlayers ??= 0
          })
      )

    this.version(15)
      .stores({})
      .upgrade(async tx => {
        await tx
          .table('games')
          .toCollection()
          .modify((g: Partial<Game>) => {
            g.soundEffectsMuted ??= false
            g.confirmUnruledNavigation ??= false
            g.autoStartTimerOnQuestionShow ??= false
            g.defaultTimerDuration ??= 60
            g.rejoinWindowSeconds ??= 0
          })
        await tx
          .table('players')
          .toCollection()
          .modify((p: Partial<Player>) => {
            p.disconnectedAt ??= null
          })
      })
  }
}

/** Module-level singleton. Import and use this in all hooks and pages. */
export const db = new ViktoraniDB()

// Another tab (a newer deploy) is upgrading the schema. Dexie closes this connection so the
// upgrade can proceed; reload so this tab runs the new code against the new schema.
db.on('versionchange', ev => {
  if (ev.newVersion) location.reload()
})

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
      db.scoreEvents,
      db.gameLog,
      db.layouts,
      db.widgets,
      db.notes,
      db.timers,
      db.gameQuestions,
      db.managedPlayers,
      db.managedTeams,
      db.managedLabels,
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
        db.scoreEvents.clear(),
        db.gameLog.clear(),
        db.layouts.clear(),
        db.widgets.clear(),
        db.notes.clear(),
        db.timers.clear(),
        db.gameQuestions.clear(),
        db.managedPlayers.clear(),
        db.managedTeams.clear(),
        db.managedLabels.clear(),
      ])
    }
  )
}
