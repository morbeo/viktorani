import type { GameVisibility } from '@/db'

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
  | { type: 'TIMER_START'; id: string; duration: number; label: string }
  /** Pauses the named timer. */
  | { type: 'TIMER_PAUSE'; id: string }
  /** Resumes the named timer from its paused position. */
  | { type: 'TIMER_RESUME'; id: string }
  /** Resets the named timer to its full duration, paused. */
  | { type: 'TIMER_RESET'; id: string; duration: number }
  /** Notifies players that a timer has reached zero. */
  | { type: 'TIMER_EXPIRED'; id: string; label: string }
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
      answer: string | null
      media: string | null
      mediaType: 'image' | 'audio' | 'video' | null
    }

/** Where question content is shown: the projector/screen or player phones. */
export type VisibilityTarget = 'players' | 'screen'

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
  /** Player pressed the buzzer. `timestamp` is a `performance.now()` value for ordering. */
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
  /** Player left the game. */
  | { type: 'LEAVE' }
  /** Player's tab visibility changed — used to flag distracted players. */
  | { type: 'FOCUS_CHANGE'; away: boolean }

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
   */
  send(event: TransportEvent): void

  /**
   * Send an event to one connection only (host side).
   * @param connId - The `from` value passed to {@link ITransport.onEvent} handlers.
   * @param event - Any {@link TransportEvent} variant.
   */
  sendTo(connId: string, event: TransportEvent): void

  /**
   * Subscribe to incoming events.
   * @param handler - Called for every event received, with the id of the connection
   *   it arrived on.
   * @returns An unsubscribe function — call it to stop receiving events.
   */
  onEvent(handler: (event: TransportEvent, from: string) => void): () => void

  /**
   * Subscribe to connections closing.
   * @param handler - Called with the id of the closed connection.
   * @returns An unsubscribe function.
   */
  onPeerClose(handler: (connId: string) => void): () => void
}
