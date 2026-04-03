// ── Shared event types ────────────────────────────────────────────────────────

export type GameEvent =
  | { type: 'SLIDE_CHANGE';   index: number; roundIndex: number }
  | { type: 'BUZZER_LOCK' }
  | { type: 'BUZZER_UNLOCK' }
  | { type: 'SCORE_UPDATE';   scores: Record<string, number> }
  | { type: 'TIMER_START';    id: string; duration: number; label: string }
  | { type: 'TIMER_PAUSE';    id: string }
  | { type: 'TIMER_RESUME';   id: string }
  | { type: 'GAME_STATE';     state: SerializedGameState }
  | { type: 'VISIBILITY';     showQuestion: boolean; showAnswers: boolean; showMedia: boolean }
  | { type: 'GAME_STATUS';    status: 'active' | 'paused' | 'ended' }

export type PlayerEvent =
  | { type: 'BUZZ';         playerId: string; playerName: string; timestamp: number }
  | { type: 'JOIN';         playerId: string; playerName: string; teamId: string | null; deviceId: string }
  | { type: 'LEAVE';        playerId: string }
  | { type: 'FOCUS_CHANGE'; playerId: string; away: boolean }

export type TransportEvent = GameEvent | PlayerEvent

export interface SerializedGameState {
  gameId:         string
  status:         string
  currentRoundIdx:number
  currentQuestionIdx: number
  buzzerLocked:   boolean
  showQuestion:   boolean
  showAnswers:    boolean
  showMedia:      boolean
  scores:         Record<string, number>
}

export interface TransportConfig {
  mode:       'auto' | 'peer' | 'gun'
  role:       'host' | 'player'
  roomId:     string
  passphrase: string         // used by Gun SEA; ignored by PeerJS
}

export type TransportStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'
export type TransportType   = 'peer' | 'gun' | null

// ── Interface all transports must implement ───────────────────────────────────

export interface ITransport {
  readonly status:        TransportStatus
  readonly transportType: TransportType

  connect(config: TransportConfig): Promise<void>
  disconnect(): void
  send(event: TransportEvent): void
  onEvent(handler: (event: TransportEvent) => void): () => void
}
