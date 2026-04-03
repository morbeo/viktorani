import { PeerJSTransport } from './PeerJSTransport'
import { GunTransport }    from './GunTransport'
import type { ITransport, TransportConfig, TransportEvent, TransportStatus, TransportType } from './types'

export type { TransportConfig, TransportEvent, TransportStatus, TransportType }
export type { GameEvent, PlayerEvent, SerializedGameState } from './types'

// ── Passphrase generator ──────────────────────────────────────────────────────

const WORDS = [
  'tiger','lamp','cloud','seven','river','amber','frost','dune','coral','echo',
  'pixel','flint','grove','jade','blaze','cedar','drift','ember','flare','gust',
  'haven','iris','joker','kite','lemon','maple','noble','opal','prism','quill',
]

export function generatePassphrase(wordCount = 4): string {
  return Array.from({ length: wordCount }, () =>
    WORDS[Math.floor(Math.random() * WORDS.length)]
  ).join('-')
}

export function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// ── Manager ───────────────────────────────────────────────────────────────────

type StatusListener = (status: TransportStatus, type: TransportType) => void

export class TransportManager {
  private transport:       ITransport | null = null
  private statusListeners: StatusListener[]  = []
  private eventHandlers:   Array<(e: TransportEvent) => void> = []

  get status():        TransportStatus { return this.transport?.status ?? 'idle' }
  get transportType(): TransportType   { return this.transport?.transportType ?? null }

  async connect(config: TransportConfig): Promise<void> {
    await this.disconnect()

    if (config.mode === 'peer') {
      await this.tryTransport(new PeerJSTransport(), config)
    } else if (config.mode === 'gun') {
      await this.tryTransport(new GunTransport(), config)
    } else {
      // Auto: try PeerJS first, fall back to Gun.js
      try {
        await this.tryTransport(new PeerJSTransport(), config)
      } catch {
        console.info('[Transport] PeerJS failed, falling back to Gun.js')
        await this.tryTransport(new GunTransport(), config)
      }
    }

    // Forward all events to registered handlers
    this.transport!.onEvent((event) => {
      this.eventHandlers.forEach(h => h(event))
    })

    this.notifyStatus()
  }

  private async tryTransport(t: ITransport, config: TransportConfig): Promise<void> {
    await t.connect(config)
    this.transport = t
  }

  async disconnect(): Promise<void> {
    this.transport?.disconnect()
    this.transport = null
    this.notifyStatus()
  }

  send(event: TransportEvent) {
    this.transport?.send(event)
  }

  onEvent(handler: (e: TransportEvent) => void): () => void {
    this.eventHandlers.push(handler)
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler)
    }
  }

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

// Singleton instance
export const transportManager = new TransportManager()
