import type {
  ITransport,
  TransportConfig,
  TransportEvent,
  TransportStatus,
  TransportType,
} from './types'

export type { TransportConfig, TransportEvent, TransportStatus, TransportType }
export type { GameEvent, PlayerEvent, SerializedGameState } from './types'

// ── Secure random helper ──────────────────────────────────────────────────────

/**
 * Returns a cryptographically secure random integer in [0, max).
 *
 * @remarks
 * Uses `crypto.getRandomValues()` — available in all modern browsers and Node >= 15.
 * Unlike `Math.random()`, the output is suitable for security-sensitive operations
 * such as passphrase generation.
 *
 * @param max - Upper bound (exclusive).
 * @returns A random integer in the range `[0, max)`.
 */
function secureRandomInt(max: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}

// ── Passphrase generator ──────────────────────────────────────────────────────

const WORDS = [
  'tiger',
  'lamp',
  'cloud',
  'seven',
  'river',
  'amber',
  'frost',
  'dune',
  'coral',
  'echo',
  'pixel',
  'flint',
  'grove',
  'jade',
  'blaze',
  'cedar',
  'drift',
  'ember',
  'flare',
  'gust',
  'haven',
  'iris',
  'joker',
  'kite',
  'lemon',
  'maple',
  'noble',
  'opal',
  'prism',
  'quill',
]

/**
 * Generate a human-readable passphrase from random dictionary words.
 *
 * @remarks
 * Used as the Gun.js SEA encryption key displayed to players via QR code
 * so they don't need to type a hex string.
 *
 * @param wordCount - Number of words to include (default `4`).
 * @returns A hyphen-separated passphrase, e.g. `'tiger-lamp-cloud-seven'`.
 *
 * @example
 * ```ts
 * const passphrase = generatePassphrase()   // 'ember-kite-coral-prism'
 * const short = generatePassphrase(2)       // 'jade-drift'
 * ```
 */
export function generatePassphrase(wordCount = 4): string {
  return Array.from({ length: wordCount }, () => WORDS[secureRandomInt(WORDS.length)]).join('-')
}

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
 * Facade over {@link PeerJSTransport} and {@link GunTransport} that handles
 * mode selection, automatic fallback, and event fan-out.
 *
 * @remarks
 * Instantiated as a module-level singleton (`transportManager`). Components
 * and hooks interact with the transport exclusively through this class --
 * never by constructing transport instances directly.
 *
 * **Mode selection** (`config.mode`):
 * - `'peer'` -- use PeerJS only.
 * - `'gun'`  -- use Gun.js only.
 * - `'auto'` -- try PeerJS; if it fails within the timeout, fall back to Gun.js.
 *
 * PeerJS and GunTransport are dynamically imported inside `connect()` so
 * neither appears in the initial bundle.
 *
 * @example
 * ```ts
 * await transportManager.connect({ mode: 'auto', role: 'host', roomId, passphrase })
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
   * PeerJS and GunTransport are imported dynamically per branch so they are
   * excluded from the initial bundle and loaded only when a connection is made.
   *
   * @param config - Room credentials and transport mode.
   * @throws If the selected transport fails to connect (non-`'auto'` modes only).
   */
  async connect(config: TransportConfig): Promise<void> {
    await this.disconnect()

    if (config.mode === 'peer') {
      const { PeerJSTransport } = await import('./PeerJSTransport')
      await this.tryTransport(new PeerJSTransport(), config)
    } else if (config.mode === 'gun') {
      const { GunTransport } = await import('./GunTransport')
      await this.tryTransport(new GunTransport(), config)
    } else {
      // Auto: try PeerJS first, fall back to Gun.js
      try {
        const { PeerJSTransport } = await import('./PeerJSTransport')
        await this.tryTransport(new PeerJSTransport(), config)
      } catch {
        console.info('[Transport] PeerJS failed, falling back to Gun.js')
        const { GunTransport } = await import('./GunTransport')
        await this.tryTransport(new GunTransport(), config)
      }
    }

    // Forward all events to registered handlers
    this.transport!.onEvent(event => {
      this.eventHandlers.forEach(h => h(event))
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
