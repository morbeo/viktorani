import Peer, { type DataConnection } from 'peerjs'
import type { ITransport, TransportConfig, TransportEvent, TransportStatus } from './types'

// PeerJS peer IDs are prefixed to avoid collisions with other apps
const PREFIX = 'vkt-'

/**
 * WebRTC transport implemented via PeerJS.
 *
 * @remarks
 * The host registers a deterministic PeerJS ID derived from the room code
 * (`vkt-<roomId>`). Players connect to that well-known ID. All data flows
 * over WebRTC data channels with DTLS encryption provided by the browser.
 *
 * Connection topology:
 * - **Host**: one `Peer` instance listens for incoming connections; each
 *   connected player gets its own `DataConnection` in `connections`, keyed by
 *   its unique `connectionId`. That id is passed to event handlers as `from`.
 * - **Player**: one `Peer` instance with a random ID; a single outbound
 *   `DataConnection` to the host.
 *
 * `connect()` resolves once the room can be used: for the host when it is
 * registered, for a player when its data channel to the host is open. It rejects
 * after 8 seconds when the PeerJS signalling server or the host is unreachable.
 */
export class PeerJSTransport implements ITransport {
  private peer: Peer | null = null
  private connections: Map<string, DataConnection> = new Map()
  private handlers: Array<(e: TransportEvent, from: string) => void> = []
  private openHandlers: Array<(connId: string) => void> = []
  private closeHandlers: Array<(connId: string) => void> = []
  private _status: TransportStatus = 'idle'
  private role: 'host' | 'player' = 'host'

  get status() {
    return this._status
  }
  get transportType() {
    return 'peer' as const
  }

  async connect(config: TransportConfig): Promise<void> {
    this.role = config.role
    this._status = 'connecting'

    return new Promise((resolve, reject) => {
      const peerId = config.role === 'host' ? PREFIX + config.roomId : undefined
      this.peer = new Peer(peerId ?? '', { debug: 0 })

      const timeout = setTimeout(() => {
        this.disconnect()
        reject(new Error('PeerJS connection timeout'))
      }, 8000)

      const ready = () => {
        clearTimeout(timeout)
        this._status = 'connected'
        resolve()
      }

      this.peer.on('open', () => {
        if (config.role === 'host') {
          ready()
          return
        }
        // Player connects to host; sends are possible once the channel opens
        const conn = this.peer!.connect(PREFIX + config.roomId, { reliable: true })
        this.setupConnection(conn)
        conn.on('open', ready)
      })

      this.peer.on('connection', conn => {
        // Host receives player connections
        this.setupConnection(conn)
      })

      this.peer.on('error', err => {
        clearTimeout(timeout)
        this._status = 'error'
        reject(err)
      })

      this.peer.on('disconnected', () => {
        this._status = 'disconnected'
      })
    })
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.connectionId, conn)
      this.openHandlers.forEach(h => h(conn.connectionId))
    })

    conn.on('data', data => {
      const event = data as TransportEvent
      this.handlers.forEach(h => h(event, conn.connectionId))
    })

    conn.on('close', () => {
      this.connections.delete(conn.connectionId)
      this.closeHandlers.forEach(h => h(conn.connectionId))
    })
  }

  disconnect() {
    this.connections.forEach(c => c.close())
    this.connections.clear()
    this.peer?.destroy()
    this.peer = null
    this._status = 'disconnected'
  }

  send(event: TransportEvent, include?: (connId: string) => boolean) {
    if (this.role === 'host') {
      // Host broadcasts to all connected players the filter accepts
      this.connections.forEach(conn => {
        if (conn.open && (!include || include(conn.connectionId))) conn.send(event)
      })
    } else {
      // Player sends to host (first connection)
      const [conn] = this.connections.values()
      if (conn?.open) conn.send(event)
    }
  }

  sendTo(connId: string, event: TransportEvent) {
    const conn = this.connections.get(connId)
    if (conn?.open) conn.send(event)
  }

  onEvent(handler: (e: TransportEvent, from: string) => void): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  onPeerOpen(handler: (connId: string) => void): () => void {
    this.openHandlers.push(handler)
    return () => {
      this.openHandlers = this.openHandlers.filter(h => h !== handler)
    }
  }

  onPeerClose(handler: (connId: string) => void): () => void {
    this.closeHandlers.push(handler)
    return () => {
      this.closeHandlers = this.closeHandlers.filter(h => h !== handler)
    }
  }
}
