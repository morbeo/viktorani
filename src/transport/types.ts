// ── Shared event types ────────────────────────────────────────────────────────

/**
 * Events broadcast by the GameMaster to all connected players.
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
  /** Notifies players that a timer has reached zero. */
  | { type: 'TIMER_EXPIRED'; id: string; label: string }
  /** Full game-state snapshot sent to newly connected players. */
  | { type: 'GAME_STATE'; state: SerializedGameState }
  /** Toggles which parts of the current question are revealed to players. */
  | { type: 'VISIBILITY'; showQuestion: boolean; showAnswers: boolean; showMedia: boolean }
  /** Lifecycle status of the game session. */
  | { type: 'GAME_STATUS'; status: 'active' | 'paused' | 'ended' }

/**
 * Events sent by players to the GameMaster.
 *
 * @remarks
 * The host listens for these via `transportManager.onEvent()` and dispatches
 * them to the appropriate hook (e.g. `useBuzzer.handleIncomingBuzz`).
 */
export type PlayerEvent =
  /** Player pressed the buzzer. `timestamp` is a `performance.now()` value for ordering. */
  | { type: 'BUZZ'; playerId: string; playerName: string; timestamp: number }
  /** Player joined the lobby. `deviceId` is a stable browser-local UUID. */
  | { type: 'JOIN'; playerId: string; playerName: string; teamId: string | null; deviceId: string }
  /** Player disconnected or left the game. */
  | { type: 'LEAVE'; playerId: string }
  /** Player's tab visibility changed — used to flag distracted players. */
  | { type: 'FOCUS_CHANGE'; playerId: string; away: boolean }

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
  showQuestion: boolean
  showAnswers: boolean
  showMedia: boolean
  scores: Record<string, number>
}

/**
 * Configuration passed to {@link transport/types.ITransport.connect}.
 *
 * @remarks
 * `passphrase` is used by Gun.js SEA for symmetric encryption of the
 * Gun node key. PeerJS ignores it — PeerJS connections are encrypted by
 * the underlying WebRTC DTLS handshake.
 */
export interface TransportConfig {
  /** Which transport to use. `'auto'` tries PeerJS first, falls back to Gun.js. */
  mode: 'auto' | 'peer' | 'gun'
  /** `'host'` creates the room; `'player'` joins an existing room. */
  role: 'host' | 'player'
  /** Six-character uppercase room code (e.g. `'XK7RQZ'`). */
  roomId: string
  /** Four-word passphrase used by Gun SEA encryption (e.g. `'tiger-lamp-cloud-seven'`). */
  passphrase: string
}

/** Lifecycle state of the underlying transport connection. */
export type TransportStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

/** Which transport implementation is currently active, or `null` if not connected. */
export type TransportType = 'peer' | 'gun' | null

// ── Interface all transports must implement ───────────────────────────────────

/**
 * Common interface implemented by {@link transport/PeerJSTransport.PeerJSTransport} and {@link transport/GunTransport.GunTransport}.
 *
 * @remarks
 * All transports are one-room-per-instance. Call `connect()` once per session;
 * call `disconnect()` before switching rooms or transport modes.
 */
export interface ITransport {
  /** Current connection lifecycle state. */
  readonly status: TransportStatus
  /** Which concrete transport is active. */
  readonly transportType: TransportType

  /**
   * Establish a connection to (or create) the specified room.
   * @param config - Room credentials and mode selection.
   * @returns Resolves when the connection is ready to send and receive events.
   */
  connect(config: TransportConfig): Promise<void>

  /** Tear down the connection and release all resources. */
  disconnect(): void

  /**
   * Send an event to the other side of the connection.
   * @param event - Any {@link TransportEvent} variant.
   */
  send(event: TransportEvent): void

  /**
   * Subscribe to incoming events.
   * @param handler - Called for every event received.
   * @returns An unsubscribe function — call it to stop receiving events.
   */
  onEvent(handler: (event: TransportEvent) => void): () => void
}
