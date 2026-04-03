import type { ITransport, TransportConfig, TransportEvent, TransportStatus } from './types'

// Gun.js and SEA are loaded as side-effect globals from CDN in index.html
// We type them loosely here to avoid needing @types packages
declare const Gun: any
declare const SEA: any

const GUN_PEERS = [
  'https://gun-manhattan.herokuapp.com/gun',
  'https://peer.wallie.io/gun',
]

export class GunTransport implements ITransport {
  private gun:      any = null
  private room:     any = null
  private handlers: Array<(e: TransportEvent) => void> = []
  private _status:  TransportStatus = 'idle'
  private passphrase: string = ''

  get status()        { return this._status }
  get transportType() { return 'gun' as const }

  async connect(config: TransportConfig): Promise<void> {
    this._status    = 'connecting'
    this.passphrase = config.passphrase

    // Generate a deterministic SEA pair from the passphrase so all peers
    // can encrypt/decrypt without exchanging keys
    // SEA pair reserved for future use
    const sharedSecret = await SEA.work(config.passphrase, config.roomId)

    this.gun  = Gun({ peers: GUN_PEERS })
    this.room = this.gun.get(`viktorani:${config.roomId}`)

    this._status = 'connected'

    // Subscribe to events
    this.room.get('events').map().on(async (encryptedData: string, key: string) => {
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
    this.gun     = null
    this.room    = null
    this._status = 'disconnected'
  }

  async send(event: TransportEvent) {
    if (!this.room || !this.passphrase) return
    const sharedSecret = await SEA.work(this.passphrase, this.room._.get.split(':')[1])
    const encrypted    = await SEA.encrypt(JSON.stringify(event), sharedSecret)
    const key          = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    this.room.get('events').get(key).put(encrypted)
  }

  onEvent(handler: (e: TransportEvent) => void): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }
}
