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
  private statusListeners: StatusListener[] = []
  private eventHandlers: Array<(e: TransportEvent) => void> = []

  /** Current connection lifecycle state. `'idle'` when not connected. */
  get status(): TransportStatus {
    return this.transport?.status ?? 'idle'
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
   * @param config - Room role and code.
   * @throws If PeerJS fails to connect.
   */
  async connect(config: TransportConfig): Promise<void> {
    await this.disconnect()

    const { PeerJSTransport } = await import('./PeerJSTransport')
    await this.tryTransport(new PeerJSTransport(), config)

    // Validate against the message contract, then forward to registered handlers
    this.transport!.onEvent(raw => {
      const event = parseTransportEvent(raw)
      if (event) this.eventHandlers.forEach(h => h(event))
    })

    this.notifyStatus()
  }

  private async tryTransport(t: ITransport, config: TransportConfig): Promise<void> {
    await t.connect(config)
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
    this.transport?.disconnect()
    this.transport = null
    this.notifyStatus()
  }

  /**
   * Send an event to all peers in the room.
   *
   * @remarks
   * Silently drops the event if not currently connected. Callers do not
   * need to guard against the disconnected state.
   *
   * @param event - Any {@link TransportEvent} variant.
   */
  send(event: TransportEvent) {
    this.transport?.send(event)
  }

  /**
   * Subscribe to incoming transport events.
   *
   * @param handler - Invoked for every event received from the room.
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
  onEvent(handler: (e: TransportEvent) => void): () => void {
    this.eventHandlers.push(handler)
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler)
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
