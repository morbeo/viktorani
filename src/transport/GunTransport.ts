import type { ITransport, TransportConfig, TransportEvent, TransportStatus } from './types'

// Gun.js and SEA are loaded as side-effect globals — no official @types package exists
declare const Gun: (opts?: Record<string, unknown>) => GunInstance
declare const SEA: {
  pair(): Promise<unknown>
  work(data: string, key: string): Promise<string>
  encrypt(data: string, key: string): Promise<string>
  decrypt(data: string, key: string): Promise<string | null>
}

type GunInstance = { get(key: string): GunNode; off(): void }
type GunNode = {
  get(key: string): GunNode
  put(val: string): void
  map(): GunNode
  on(cb: (data: string, key: string) => void): void
  _: { get: string }
}

const GUN_PEERS = ['https://gun-manhattan.herokuapp.com/gun', 'https://peer.wallie.io/gun']

/**
 * Relay-server transport implemented via Gun.js with SEA encryption.
 *
 * @remarks
 * Gun.js is a decentralised, eventually-consistent graph database that uses
 * public relay servers as a signalling and message-relay layer. Unlike PeerJS,
 * it does not require a direct WebRTC connection between peers — all data flows
 * through the relay, making it more reliable behind restrictive NATs and
 * corporate firewalls.
 *
 * **Encryption:** Every event is symmetrically encrypted with
 * [SEA](https://gun.eco/docs/SEA) (Security, Encryption, Authorization) using
 * a shared secret derived from `passphrase` + `roomId` via `SEA.work()`. This
 * prevents relay server operators or other Gun.js users from reading game data.
 * The passphrase is displayed to players as part of the QR code payload.
 *
 * **Namespace:** Events are written to the Gun graph under the key
 * `viktorani:<roomId>/events/<timestamp-random>`. Each event gets a unique
 * key so Gun's CRDT merge does not overwrite previous entries.
 *
 * **Fallback role:** In `'auto'` mode, {@link transport.TransportManager} instantiates
 * this class only when {@link transport/PeerJSTransport.PeerJSTransport} fails — typically when the
 * PeerJS cloud server is unreachable.
 */
export class GunTransport implements ITransport {
  private gun: GunInstance | null = null
  private room: GunNode | null = null
  private handlers: Array<(e: TransportEvent) => void> = []
  private _status: TransportStatus = 'idle'
  private passphrase: string = ''

  get status() {
    return this._status
  }
  get transportType() {
    return 'gun' as const
  }

  async connect(config: TransportConfig): Promise<void> {
    this._status = 'connecting'
    this.passphrase = config.passphrase

    // Generate a deterministic SEA pair from the passphrase so all peers
    // can encrypt/decrypt without exchanging keys
    // SEA pair reserved for future use
    const sharedSecret = await SEA.work(config.passphrase, config.roomId)

    this.gun = Gun({ peers: GUN_PEERS })
    this.room = this.gun.get(`viktorani:${config.roomId}`)

    this._status = 'connected'

    // Subscribe to events
    this.room
      .get('events')
      .map()
      .on(async (encryptedData: string, key: string) => {
        if (!encryptedData || key === '_') return
        try {
          const decrypted = await SEA.decrypt(encryptedData, sharedSecret)
          if (decrypted) {
            const event = JSON.parse(decrypted) as TransportEvent
            this.handlers.forEach(h => h(event))
          }
        } catch {
          // Ignore decryption failures (wrong room / stale data)
        }
      })
  }

  disconnect() {
    this.gun?.off()
    this.gun = null
    this.room = null
    this._status = 'disconnected'
  }

  async send(event: TransportEvent) {
    if (!this.room || !this.passphrase) return
    const sharedSecret = await SEA.work(this.passphrase, this.room._.get.split(':')[1])
    const encrypted = await SEA.encrypt(JSON.stringify(event), sharedSecret)
    const keyBytes = new Uint32Array(1)
    crypto.getRandomValues(keyBytes)
    const key = `${Date.now()}-${keyBytes[0].toString(36)}`
    this.room.get('events').get(key).put(encrypted)
  }

  onEvent(handler: (e: TransportEvent) => void): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }
}
