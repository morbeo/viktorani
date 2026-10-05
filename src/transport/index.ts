import { parseTransportEvent } from './messages'
import type {
  ITransport,
  TransportConfig,
  TransportEvent,
  TransportStatus,
  TransportType,
} from './types'

export type { TransportConfig, TransportEvent, TransportStatus, TransportType }
export type { GameEvent, PlayerEvent, SerializedGameState } from './types'
export {
  GameEventSchemas,
  PlayerEventSchemas,
  SerializedGameStateSchema,
  TransportEventSchema,
  parseTransportEvent,
} from './messages'

// ── Secure random helper ──────────────────────────────────────────────────────

/**
 * Returns a cryptographically secure random integer in [0, max).
 *
 * @remarks
 * Uses `crypto.getRandomValues()` — available in all modern browsers and Node >= 15.
 * Unlike `Math.random()`, the output is suitable for security-sensitive operations
 * such as room ID generation.
 *
 * @param max - Upper bound (exclusive).
 * @returns A random integer in the range `[0, max)`.
 */
function secureRandomInt(max: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}

// ── Room ID generator ─────────────────────────────────────────────────────────

/**
 * Generate a random 6-character room ID using an unambiguous character set.
 *
 * @remarks
 * Characters `I`, `O`, `0`, and `1` are omitted to avoid visual confusion
 * when reading codes aloud or from a small screen.
 *
 * @returns An uppercase alphanumeric string such as `'XK7RQZ'`.
 *
 * @example
 * ```ts
 * const roomId = generateRoomId() // 'XK7RQZ'
 * ```
 */
export function generateRoomId(): string {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => CHARS[secureRandomInt(CHARS.length)]).join('')
}

/** The error a connect() rejects with when disconnect() overtakes it. */
function cancelled(): DOMException {
  return new DOMException('Transport connect cancelled', 'AbortError')
}

// ── Errors and retries ────────────────────────────────────────────────────────

/** Whether `err` is the AbortError a connect rejects with when it is cancelled on purpose. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * A short, user-facing explanation of a transport error.
 *
 * @param err - A PeerJS error (which carries a `type`), a timeout, or anything else.
 * @returns A sentence that can be shown as is.
 */
export function describeTransportError(err: unknown): string {
  const type = (err as { type?: unknown } | null)?.type
  switch (type) {
    case 'peer-unavailable':
      return 'The host is not online. Check the room code, or wait for the host to open the game.'
    case 'unavailable-id':
      return 'This room is already open in another tab or on another device.'
    case 'browser-incompatible':
      return 'This browser does not support the peer-to-peer connections the game needs.'
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
    case 'disconnected':
      return 'Cannot reach the connection server. Check your internet connection.'
  }
  if (err instanceof Error && err.message === 'PeerJS connection timeout') {
    return 'Timed out connecting. Check your internet connection.'
  }
  return 'The connection failed.'
}

/** Delays before each retry of {@link retry}: three more tries over about ten seconds. */
export const RETRY_DELAYS = [1000, 3000, 6000]

/**
 * Run `attempt` until it resolves, waiting each of `delays` between tries.
 *
 * @remarks
 * Gives up at once on an AbortError or once `cancelled` returns true (the page was
 * left), rejecting with an AbortError, and otherwise rejects with the last error once
 * the delays are used up.
 *
 * @param attempt - The operation to try, e.g. connecting and re-sending a JOIN.
 * @param options.onRetry - Called before each wait with the retry number (from 1).
 * @param options.cancelled - Checked after each failure and wait.
 * @param options.delays - Defaults to {@link RETRY_DELAYS}.
 */
export async function retry<T>(
  attempt: () => Promise<T>,
  {
    onRetry,
    cancelled = () => false,
    delays = RETRY_DELAYS,
  }: { onRetry?: (n: number) => void; cancelled?: () => boolean; delays?: number[] } = {}
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await attempt()
    } catch (err) {
      if (isAbortError(err)) throw err
      if (cancelled()) throw new DOMException('Retry cancelled', 'AbortError')
      if (i >= delays.length) throw err
      onRetry?.(i + 1)
      await new Promise(resolve => setTimeout(resolve, delays[i]))
      if (cancelled()) throw new DOMException('Retry cancelled', 'AbortError')
    }
  }
}

// ── Manager ───────────────────────────────────────────────────────────────────

/** Callback invoked when the transport connection status or type changes. */
export type StatusListener = (status: TransportStatus, type: TransportType) => void

/**
 * Facade over {@link PeerJSTransport} that handles connection lifecycle and
 * event fan-out.
 *
 * @remarks
 * Instantiated as a module-level singleton (`transportManager`). Components
 * and hooks interact with the transport exclusively through this class --
 * never by constructing transport instances directly.
 *
 * PeerJS is dynamically imported inside `connect()` so it does not appear in
 * the initial bundle.
 *
 * @example
 * ```ts
 * await transportManager.connect({ role: 'host', roomId })
 * const unsub = transportManager.onEvent(event => console.log(event))
 * transportManager.send({ type: 'BUZZER_LOCK' })
 * unsub()
 * await transportManager.disconnect()
 * ```
 */
export class TransportManager {
  private transport: ITransport | null = null
  // The transport still connecting, so disconnect() can tear it down before it is ready
  private pending: ITransport | null = null
  // Bumped by every disconnect(); a connect() that started before it is stale
  private generation = 0
  private statusListeners: StatusListener[] = []
  private eventHandlers: Array<(e: TransportEvent, from: string) => void> = []
  private openHandlers: Array<(connId: string) => void> = []
  private closeHandlers: Array<(connId: string) => void> = []
  private broadcastFilter: ((connId: string) => boolean) | null = null
  private lastError: string | null = null

  /** Current connection lifecycle state: `'idle'` when not connected, `'error'` after a failed connect. */
  get status(): TransportStatus {
    return this.transport?.status ?? (this.lastError ? 'error' : 'idle')
  }

  /** What went wrong with the connection, for showing to the user; `null` when nothing did. */
  get error(): string | null {
    return this.lastError
  }

  /** Which concrete transport is active, or `null` when not connected. */
  get transportType(): TransportType {
    return this.transport?.transportType ?? null
  }

  /**
   * Connect to (or create) a room using the specified configuration.
   *
   * @remarks
   * Any existing connection is cleanly disconnected before the new one starts.
   * All previously registered event handlers are preserved -- they will receive
   * events from the new connection without needing to re-subscribe.
   *
   * PeerJS is imported dynamically so it is excluded from the initial bundle
   * and loaded only when a connection is made.
   *
   * A failed connect leaves the status at `'error'` with {@link TransportManager.error}
   * set, and notifies status listeners; a cancelled one (AbortError) stays `'idle'`.
   *
   * @param config - Room role and code.
   * @throws If PeerJS fails to connect.
   */
  async connect(config: TransportConfig): Promise<void> {
    const previous = this.disconnect()
    // Read before awaiting, so a disconnect() that lands while this awaits makes it stale
    const generation = this.generation
    await previous

    const { PeerJSTransport } = await import('./PeerJSTransport')
    if (generation !== this.generation) throw cancelled()
    try {
      await this.tryTransport(new PeerJSTransport(), config, generation)
    } catch (err) {
      if (!isAbortError(err)) {
        this.lastError = describeTransportError(err)
        this.notifyStatus()
      }
      throw err
    }

    // Validate against the message contract, then forward to registered handlers
    this.transport!.onEvent((raw, from) => {
      const event = parseTransportEvent(raw)
      if (event) this.eventHandlers.forEach(h => h(event, from))
    })
    this.transport!.onPeerOpen(connId => this.openHandlers.forEach(h => h(connId)))
    this.transport!.onPeerClose(connId => this.closeHandlers.forEach(h => h(connId)))
    this.transport!.onStatusChange((status, err) => {
      this.lastError = status === 'connected' || !err ? null : describeTransportError(err)
      this.notifyStatus()
    })

    this.notifyStatus()
  }

  private async tryTransport(
    t: ITransport,
    config: TransportConfig,
    generation: number
  ): Promise<void> {
    this.pending = t
    try {
      await t.connect(config)
    } finally {
      if (this.pending === t) this.pending = null
    }
    // disconnect() or a newer connect() ran meanwhile: release this peer instead of keeping it
    if (generation !== this.generation) {
      t.disconnect()
      throw cancelled()
    }
    this.transport = t
  }

  /**
   * Disconnect from the current room and release all transport resources.
   *
   * @remarks
   * Safe to call when not connected -- it is a no-op in that case.
   * Status listeners are notified after disconnection.
   */
  async disconnect(): Promise<void> {
    this.generation++
    this.pending?.disconnect()
    this.pending = null
    this.transport?.disconnect()
    this.transport = null
    this.lastError = null
    this.notifyStatus()
  }

  /**
   * Send an event to all peers in the room. On the host, only connections accepted by
   * the broadcast filter receive it (see {@link TransportManager.setBroadcastFilter}).
   *
   * @remarks
   * Silently drops the event if not currently connected. Callers do not
   * need to guard against the disconnected state.
   *
   * @param event - Any {@link TransportEvent} variant.
   */
  send(event: TransportEvent) {
    this.transport?.send(event, this.broadcastFilter ?? undefined)
  }

  /**
   * Host side: send an event to every open connection, ignoring the broadcast filter.
   * Only for data anyone with the room code may see, such as LOBBY_INFO for join screens.
   *
   * @param event - Any {@link TransportEvent} variant.
   */
  sendToAll(event: TransportEvent) {
    this.transport?.send(event)
  }

  /**
   * Host side: limit {@link TransportManager.send} to the connections `filter` accepts,
   * e.g. admitted players. Kept across reconnects; pass `null` to broadcast to everyone.
   *
   * @param filter - Called with each connection id at send time.
   */
  setBroadcastFilter(filter: ((connId: string) => boolean) | null) {
    this.broadcastFilter = filter
  }

  /**
   * Send an event to one connection only (host side). Silently dropped if not
   * connected or the connection is gone.
   *
   * @param connId - The `from` value an {@link TransportManager.onEvent} handler received.
   * @param event - Any {@link TransportEvent} variant.
   */
  sendTo(connId: string, event: TransportEvent) {
    this.transport?.sendTo(connId, event)
  }

  /**
   * Host side: forcibly close one connection, e.g. to disconnect a screen. A no-op if not
   * connected or the connection is already gone.
   *
   * @param connId - The `from` value an {@link TransportManager.onEvent} handler received.
   */
  closeConnection(connId: string) {
    this.transport?.closeConnection(connId)
  }

  /**
   * Subscribe to incoming transport events.
   *
   * @param handler - Invoked for every valid event received from the room, with the
   *   id of the connection it arrived on. On the host, use `from` (never a field in the
   *   payload) to decide which player sent it.
   * @returns An unsubscribe function. Call it in a `useEffect` cleanup or
   *          component teardown to avoid memory leaks.
   *
   * @example
   * ```ts
   * useEffect(() => {
   *   return transportManager.onEvent(event => {
   *     if (event.type === 'BUZZ') handleBuzz(event)
   *   })
   * }, [])
   * ```
   */
  onEvent(handler: (e: TransportEvent, from: string) => void): () => void {
    this.eventHandlers.push(handler)
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler)
    }
  }

  /**
   * Subscribe to connections opening (host side: a player connected and has not joined
   * yet). Preserved across reconnects, like {@link TransportManager.onEvent}.
   *
   * @param handler - Called with the id of the opened connection.
   * @returns An unsubscribe function.
   */
  onPeerOpen(handler: (connId: string) => void): () => void {
    this.openHandlers.push(handler)
    return () => {
      this.openHandlers = this.openHandlers.filter(h => h !== handler)
    }
  }

  /**
   * Subscribe to connections closing (host side: a player's connection dropped).
   * Preserved across reconnects, like {@link TransportManager.onEvent}.
   *
   * @param handler - Called with the id of the closed connection.
   * @returns An unsubscribe function.
   */
  onPeerClose(handler: (connId: string) => void): () => void {
    this.closeHandlers.push(handler)
    return () => {
      this.closeHandlers = this.closeHandlers.filter(h => h !== handler)
    }
  }

  /**
   * Subscribe to connection status changes.
   *
   * @param listener - Called whenever `status` or `transportType` changes.
   * @returns An unsubscribe function.
   */
  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener)
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener)
    }
  }

  private notifyStatus() {
    this.statusListeners.forEach(l => l(this.status, this.transportType))
  }
}

/** Module-level singleton -- import and use this directly rather than instantiating. */
export const transportManager = new TransportManager()
