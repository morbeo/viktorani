import type { ConnectionRoute } from './route'
import type {
  GamePhase,
  GameVisibility,
  InputType,
  Layout,
  LayoutSlot,
  TeamAnswering,
  Widget,
} from '@/db'
import type { ResolvedTheme } from '@/lib/theme'

// ── Shared event types ────────────────────────────────────────────────────────

/**
 * Events sent by the GameMaster to players: broadcast with `send`, or to one
 * connection with `sendTo` (join replies, per-player content).
 *
 * @remarks
 * All variants are discriminated by `type`. Consumers should switch on `type`
 * and handle only the variants they care about.
 *
 * @example
 * ```ts
 * transport.onEvent(event => {
 *   if (event.type === 'SLIDE_CHANGE') {
 *     goToSlide(event.index)
 *   }
 * })
 * ```
 */
export type GameEvent =
  /** Instructs players to navigate to a specific question within a round. */
  | { type: 'SLIDE_CHANGE'; index: number; roundIndex: number }
  /** Locks the buzzer — no new buzzes are accepted. */
  | { type: 'BUZZER_LOCK' }
  /** Unlocks the buzzer — players may buzz in. */
  | { type: 'BUZZER_UNLOCK' }
  /** Updated score map keyed by player or team ID. */
  | { type: 'SCORE_UPDATE'; scores: Record<string, number> }
  /** Starts a new countdown timer visible to players. */
  /** `remaining` is the seconds left, for a timer already running; defaults to `duration`. */
  | { type: 'TIMER_START'; id: string; duration: number; label: string; remaining?: number }
  /** Pauses the named timer. */
  | { type: 'TIMER_PAUSE'; id: string }
  /** Resumes the named timer from its paused position. */
  | { type: 'TIMER_RESUME'; id: string }
  /** Resets the named timer to its full duration, paused. */
  | { type: 'TIMER_RESET'; id: string; duration: number }
  /** Removes the named timer; the host deleted it. */
  | { type: 'TIMER_DELETE'; id: string }
  /** Notifies players that a timer has reached zero. */
  /** `audio` and `visual` say whether players should beep and show the expiry popup. */
  | { type: 'TIMER_EXPIRED'; id: string; label: string; audio: boolean; visual: boolean }
  /** Full game-state snapshot sent to newly connected players. */
  | { type: 'GAME_STATE'; state: SerializedGameState }
  /** Toggles which parts of the current question are revealed on one target. */
  | {
      type: 'VISIBILITY'
      target: VisibilityTarget
      showQuestion: boolean
      showAnswers: boolean
      showMedia: boolean
    }
  /** Lifecycle status of the game session. */
  | { type: 'GAME_STATUS'; status: 'active' | 'paused' | 'ended' }
  /** Sent to a connection before it joins: what it may choose on the join screen. */
  | {
      type: 'LOBBY_INFO'
      teams: LobbyTeam[]
      allowIndividual: boolean
      allowPlayerTeams: boolean
      /** Whether people may watch without playing (see `Game.allowSpectators`). */
      allowSpectators: boolean
    }
  /** The JOIN is waiting for host approval. */
  | { type: 'JOIN_PENDING' }
  /** The JOIN was accepted; `playerId` is assigned by the host. */
  | { type: 'JOIN_ACCEPTED'; playerId: string; teamId: string | null }
  /** The JOIN was refused. */
  | { type: 'JOIN_REJECTED'; reason: string }
  /**
   * Content of the current question for one target. Fields the GM has hidden on that
   * target are `null`.
   */
  | {
      type: 'QUESTION_CONTENT'
      target: VisibilityTarget
      questionId: string
      title: string | null
      description: string | null
      options: string[] | null
      /** The correct answer, `null` until the host reveals it (ADR 0023). */
      answer: string | null
      /**
       * How many options a player may pick from, while the host takes choice answers to
       * this question; `null` otherwise, and always for the screen.
       */
      choices: number | null
      /** Whether the host takes typed answers to this question now; always `false` for the screen. */
      acceptsText: boolean
      media: string | null
      mediaType: 'image' | 'audio' | 'video' | null
    }
  /** The SCREEN_JOIN was approved; the connection now receives what the screen shows. */
  | { type: 'SCREEN_ACCEPTED' }
  /** Ranked scores with names, sent to approved screens only. Empty when scoring is off. */
  | { type: 'SCOREBOARD'; rows: ScoreboardRow[] }
  /**
   * A short plain-text note from the host to some players, a team or the screens. It stays
   * shown until the next MESSAGE; `text: null` clears it.
   */
  | { type: 'MESSAGE'; text: string | null }
  /**
   * The most recent public game-log entries, newest first, sent to screens only. Resent
   * whenever the log changes and when a screen is approved.
   */
  | { type: 'LOG'; entries: LogEntry[] }
  /**
   * The stored layouts a remote surface may show: for each game phase, the one the host
   * would pick, without duplicates. The surface picks among them for its own phase and
   * falls back to its built-in default when none fits or `layouts` is empty. Sent to
   * players on admit (and so on rejoin), to screens on approval, and to both whenever the
   * stored layouts change.
   */
  | {
      type: 'LAYOUT'
      target: RemoteLayoutTarget
      gameId: string
      layouts: LayoutPayload[]
      /** The layout ids the host chose for this surface, per phase (#415). */
      assignments: Partial<Record<LayoutSlot, string>>
    }
  /**
   * The phase layouts are picked for: worked out from the game's state, or chosen by the
   * GM. Sent to players and screens whenever it changes, on admit and on screen approval.
   */
  | { type: 'PHASE'; phase: GamePhase }
  /**
   * The game's theme, resolved on the host (ADR 0022): both palettes, so each device picks
   * light or dark itself, and no mode. Sent to players on admit, to screens on approval,
   * and to both whenever the game or app theme changes. Layout overrides stay in `LAYOUT`.
   */
  | { type: 'THEME'; theme: ResolvedTheme }
  /**
   * The answers revealed so far in the host's end-of-round review (ADR 0023), for one
   * target, or `null` once the review is closed. Sent whenever a review answer is revealed,
   * on admit and on screen approval while a review is open.
   */
  | { type: 'ROUND_ANSWERS'; target: VisibilityTarget; review: RoundAnswers | null }
  /**
   * The round's earlier questions players can still answer, in a game that keeps answers
   * open until the end of the round (see `Game.answersClose`); empty when there are none.
   * Sent to players whenever the list changes and on admit. The question shown is not in it.
   */
  | { type: 'OPEN_QUESTIONS'; questions: OpenQuestion[] }
  /**
   * How the player's team decides its answers (see `Game.teamAnswering`), and the team's
   * current answers to the questions players can answer. Sent to each team's members in a
   * team game that takes answers on phones, whenever it changes and on admit.
   */
  | {
      type: 'TEAM_ANSWERS'
      mode: TeamAnswering
      /** The member who answers for the team; set only in `captain` mode. */
      captainId: string | null
      captainName: string | null
      answers: TeamAnswer[]
    }

/** An earlier question of the round players can still answer, as sent in `OPEN_QUESTIONS`. */
export interface OpenQuestion {
  questionId: string
  /** Position of the question in its round, from 1. */
  number: number
  /** `null` when players may not see the question. */
  title: string | null
  /** `null` when players may not see the options, or the question has none. */
  options: string[] | null
  /** How many options a player may pick from, in a `choice` game; else `null`. */
  choices: number | null
  /** Whether players may type an answer, in a `text` game. */
  acceptsText: boolean
}

/** A team's current answer to an open question, as sent in `TEAM_ANSWERS`. */
export interface TeamAnswer {
  questionId: string
  /** The member who sent it. */
  playerId: string
  playerName: string
  /** The option picked, in a `choice` game; else `null`. */
  choice: number | null
  /** The text typed, in a `text` game; else `null`. */
  text: string | null
  /** In `vote` mode, the votes per answer, most first; else empty. */
  votes: Array<{ choice: number | null; text: string | null; count: number }>
}

/** How the end-of-round review shows the round's answers. */
export type RoundReviewView = 'list' | 'table'

/** The revealed answers of one round, as sent in `ROUND_ANSWERS`. */
export interface RoundAnswers {
  roundName: string
  view: RoundReviewView
  items: RoundAnswerItem[]
}

/** One revealed question of a round review. */
export interface RoundAnswerItem {
  questionId: string
  /** Position of the question in its round, from 1. */
  number: number
  /** `null` when the target may not see the question. */
  title: string | null
  answer: string
  /** The host's ruling on the question. */
  status: 'pending' | 'correct' | 'incorrect' | 'skipped'
}

/** Surfaces on other devices that get their layout over the transport. */
export type RemoteLayoutTarget = 'player' | 'screen'

/** One layout and its widgets, as sent in `LAYOUT`. */
export interface LayoutPayload {
  layout: Layout
  widgets: Widget[]
}

/** Where question content is shown: the projector/screen or player phones. */
export type VisibilityTarget = 'players' | 'screen'

/**
 * Kinds of game-log entry safe to show on a screen: no device or connection ids, no join
 * or screen rejections, and nothing a host visibility setting currently hides. Team/player
 * status changes (joined, left, kicked, disconnected) are included — screens may show them.
 */
export const PUBLIC_LOG_KINDS = [
  'game_started',
  'game_paused',
  'game_resumed',
  'game_ended',
  'question_shown',
  'round_changed',
  'player_joined',
  'player_rejoined',
  'player_hidden',
  'player_back',
  'player_disconnected',
  'player_left',
  'player_kicked',
  'team_created',
  'buzzer_locked',
  'buzzer_unlocked',
  'buzzes_cleared',
  'timer_started',
  'timer_paused',
  'timer_resumed',
  'timer_reset',
  'timer_expired',
  'buzz',
  'false_start',
  'ruling',
  'score_changed',
] as const

export type PublicLogKind = (typeof PUBLIC_LOG_KINDS)[number]

/** One game-log entry, already formatted for display, as sent to screens. */
export interface LogEntry {
  id: string
  at: number
  kind: PublicLogKind
  /** The player or team involved; empty for host-only actions. */
  who: string
  details: string
}

/** One player or team on the screen's scoreboard. */
export interface ScoreboardRow {
  id: string
  name: string
  score: number
  /** Place in the standings, from 1; tied rows share one. */
  place: number
}

/** A team a joining player can pick, as listed in `LOBBY_INFO`. */
export interface LobbyTeam {
  id: string
  name: string
}

/**
 * Events sent by players to the GameMaster.
 *
 * @remarks
 * Players never name themselves: the host maps each connection to a player on
 * JOIN and derives the player for every later event from the connection it
 * arrived on (see `TransportManager.onEvent`'s `from` argument).
 */
export type PlayerEvent =
  /**
   * Player pressed the buzzer. `timestamp` is the player's `Date.now()`; the host ranks
   * buzzes by when they arrive, not by this value.
   */
  | { type: 'BUZZ'; timestamp: number }
  /**
   * Player asks to join. `deviceId` is a stable browser-local UUID, used only to match
   * rejoins. Either pick an existing `teamId`, ask for `newTeamName`, or neither.
   */
  | {
      type: 'JOIN'
      playerName: string
      deviceId: string
      teamId: string | null
      newTeamName: string | null
    }
  /**
   * Player's answer to the question `questionId`: option `choice` (from 0) in a game that
   * takes choice answers, or typed `text` in one that takes typed answers; exactly one is
   * set. A later one replaces it until the host closes the question.
   */
  | { type: 'ANSWER'; questionId: string; choice: number | null; text: string | null }
  /** Player left the game. */
  | { type: 'LEAVE' }
  /** Player's tab visibility changed — used to flag distracted players. */
  | { type: 'FOCUS_CHANGE'; away: boolean }
  /**
   * A projector screen asks to follow the game. Needs GM approval, like a player JOIN. With
   * `watch`, a spectator asks instead: let in without approval when the game allows them.
   */
  | { type: 'SCREEN_JOIN'; watch?: true }

/** Union of all events that flow through the transport layer. */
export type TransportEvent = GameEvent | PlayerEvent

/**
 * Minimal game-state snapshot sent to players on join so they can
 * render the current question, scores, and buzzer state without DB access.
 */
export interface SerializedGameState {
  gameId: string
  status: string
  currentRoundIdx: number
  currentQuestionIdx: number
  /** How players answer: no input, the buzzer, or a choice (ADR 0023). */
  inputType: InputType
  buzzerLocked: boolean
  /** What each target shows, as last set by the GM (see `VISIBILITY`). */
  visibility: GameVisibility
  /** Current player and team scores keyed by player or team ID, as in `SCORE_UPDATE`. */
  scores: Record<string, number>
}

/**
 * Configuration passed to {@link transport/types.ITransport.connect}.
 *
 * @remarks
 * PeerJS connections are encrypted by the underlying WebRTC DTLS handshake.
 */
export interface TransportConfig {
  /** `'host'` creates the room; `'player'` joins an existing room. */
  role: 'host' | 'player'
  /** Six-character uppercase room code (e.g. `'XK7RQZ'`). */
  roomId: string
}

/** Lifecycle state of the underlying transport connection. */
export type TransportStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

/** Which transport implementation is currently active, or `null` if not connected. */
export type TransportType = 'peer' | null

// ── Interface all transports must implement ───────────────────────────────────

/**
 * Interface implemented by {@link transport/PeerJSTransport.PeerJSTransport}.
 *
 * @remarks
 * All transports are one-room-per-instance. Call `connect()` once per session;
 * call `disconnect()` before switching rooms.
 */
export interface ITransport {
  /** Current connection lifecycle state. */
  readonly status: TransportStatus
  /** Which concrete transport is active. */
  readonly transportType: TransportType

  /**
   * Establish a connection to (or create) the specified room.
   * @param config - Room role and code.
   * @returns Resolves when the connection is ready to send and receive events.
   */
  connect(config: TransportConfig): Promise<void>

  /** Tear down the connection and release all resources. */
  disconnect(): void

  /**
   * Send an event to the other side: the host broadcasts to every player, a player
   * sends to the host.
   * @param event - Any {@link TransportEvent} variant.
   * @param include - Host side only: when given, the broadcast skips connections it rejects.
   */
  send(event: TransportEvent, include?: (connId: string) => boolean): void

  /**
   * Send an event to one connection only (host side).
   * @param connId - The `from` value passed to {@link ITransport.onEvent} handlers.
   * @param event - Any {@link TransportEvent} variant.
   */
  sendTo(connId: string, event: TransportEvent): void

  /**
   * Host side: forcibly close one connection, e.g. to disconnect a screen. A no-op if the
   * connection is already gone. Does not guarantee {@link ITransport.onPeerClose} fires for
   * it afterwards — callers that need cleanup should do it directly, not rely on the event.
   * @param connId - The `from` value passed to {@link ITransport.onEvent} handlers.
   */
  closeConnection(connId: string): void

  /**
   * Host side: how one connection reaches the host, from the browser's WebRTC stats.
   * Transports that can't tell leave it out, and callers treat that as `unknown`.
   * @param connId - The `from` value passed to {@link ITransport.onEvent} handlers.
   */
  connectionRoute?(connId: string): Promise<ConnectionRoute>

  /**
   * Subscribe to incoming events.
   * @param handler - Called for every event received, with the id of the connection
   *   it arrived on.
   * @returns An unsubscribe function — call it to stop receiving events.
   */
  onEvent(handler: (event: TransportEvent, from: string) => void): () => void

  /**
   * Subscribe to connections opening (host side: a player connected, before any JOIN).
   * @param handler - Called with the id of the opened connection.
   * @returns An unsubscribe function.
   */
  onPeerOpen(handler: (connId: string) => void): () => void

  /**
   * Subscribe to connections closing.
   * @param handler - Called with the id of the closed connection.
   * @returns An unsubscribe function.
   */
  onPeerClose(handler: (connId: string) => void): () => void

  /**
   * Subscribe to status changes after `connect()` has resolved, such as losing the
   * signalling server or the host, reconnecting, or giving up.
   * @param handler - Called with the new status and the error behind it, if any.
   * @returns An unsubscribe function.
   */
  onStatusChange(handler: (status: TransportStatus, error: unknown) => void): () => void
}
