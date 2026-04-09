import Peer, { type DataConnection } from 'peerjs'
import type { ITransport, TransportConfig, TransportEvent, TransportStatus } from './types'

// PeerJS peer IDs are prefixed to avoid collisions with other apps
const PREFIX = 'vkt-'

export class PeerJSTransport implements ITransport {
  private peer: Peer | null = null
  private connections: Map<string, DataConnection> = new Map()
  private handlers: Array<(e: TransportEvent) => void> = []
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

      this.peer.on('open', () => {
        clearTimeout(timeout)
        this._status = 'connected'

        if (config.role === 'player') {
          // Player connects to host
          const conn = this.peer!.connect(PREFIX + config.roomId, { reliable: true })
          this.setupConnection(conn)
        }

        resolve()
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
      this.connections.set(conn.peer, conn)
    })

    conn.on('data', data => {
      const event = data as TransportEvent
      this.handlers.forEach(h => h(event))
    })

    conn.on('close', () => {
      this.connections.delete(conn.peer)
    })
  }

  disconnect() {
    this.connections.forEach(c => c.close())
    this.connections.clear()
    this.peer?.destroy()
    this.peer = null
    this._status = 'disconnected'
  }

  send(event: TransportEvent) {
    if (this.role === 'host') {
      // Host broadcasts to all connected players
      this.connections.forEach(conn => {
        if (conn.open) conn.send(event)
      })
    } else {
      // Player sends to host (first connection)
      const [conn] = this.connections.values()
      if (conn?.open) conn.send(event)
    }
  }

  onEvent(handler: (e: TransportEvent) => void): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }
}
