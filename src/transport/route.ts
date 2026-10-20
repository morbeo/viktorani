/**
 * How a connection reaches the host: `local` when it runs directly over the local network,
 * `remote` when it goes through the internet (a NAT or a relay), `unknown` when the
 * browser can't tell.
 */
export type ConnectionRoute = 'local' | 'remote' | 'unknown'

/** The fields of an ICE candidate's stats this module reads. */
interface CandidateStats {
  candidateType?: string
  address?: string
  ip?: string
}

/**
 * Whether `address` belongs to a local network: a private, link-local or loopback IP, or
 * an mDNS name (`*.local`), which browsers use to hide local IPs and which resolves only
 * on the same network.
 */
export function isLocalAddress(address: string): boolean {
  const a = address.toLowerCase()
  if (a.endsWith('.local')) return true
  const v4 = a.match(/^(\d+)\.(\d+)\.\d+\.\d+$/)
  if (v4) {
    const [first, second] = [Number(v4[1]), Number(v4[2])]
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254)
    )
  }
  const v6 = expandIpv6(a)
  if (!v6) return false
  const head = parseInt(v6[0], 16)
  return (
    v6.join(':') === '0:0:0:0:0:0:0:1' ||
    (head & 0xffc0) === 0xfe80 || // link-local
    (head & 0xfe00) === 0xfc00 // unique local
  )
}

/** The eight hextets of an IPv6 address (without leading zeros), or `null` if it isn't one. */
function expandIpv6(address: string): string[] | null {
  if (!address.includes(':')) return null
  const [head, tail, extra] = address.replace(/^\[|\]$/g, '').split('::')
  if (extra !== undefined) return null
  const left = head ? head.split(':') : []
  const right = tail !== undefined && tail !== '' ? tail.split(':') : []
  const missing = 8 - left.length - right.length
  if (tail === undefined ? missing !== 0 : missing < 1) return null
  const groups = [...left, ...Array<string>(tail === undefined ? 0 : missing).fill('0'), ...right]
  if (!groups.every(g => /^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map(g => parseInt(g, 16).toString(16))
}

/** Whether two IPv6 addresses share their /64 prefix, i.e. sit on the same network. */
function sameIpv6Network(a: string, b: string): boolean {
  const x = expandIpv6(a.toLowerCase())
  const y = expandIpv6(b.toLowerCase())
  return !!x && !!y && x.slice(0, 4).join(':') === y.slice(0, 4).join(':')
}

/**
 * Read a connection's route from its `RTCPeerConnection.getStats()` report, using the
 * candidate pair the browser selected.
 *
 * @remarks
 * Local means both ends used their own addresses (`host` candidates, or a `prflx` one the
 * other end learned from the traffic) and the remote address is on a local network: a
 * private IP, an mDNS name, or an IPv6 address in the host's /64. A `srflx` (through a
 * NAT) or `relay` (through TURN) candidate on either end means the internet.
 */
export function routeFromStats(stats: RTCStatsReport): ConnectionRoute {
  const entries = new Map<string, Record<string, unknown>>()
  stats.forEach((s: Record<string, unknown>) => entries.set(s.id as string, s))

  let pair: Record<string, unknown> | undefined
  for (const s of entries.values()) {
    if (s.type === 'transport' && typeof s.selectedCandidatePairId === 'string') {
      pair = entries.get(s.selectedCandidatePairId)
      if (pair) break
    }
  }
  // Firefox marks the pair itself
  pair ??= [...entries.values()].find(
    s =>
      s.type === 'candidate-pair' &&
      (s.selected === true || (s.nominated && s.state === 'succeeded'))
  )
  if (!pair) return 'unknown'

  const local = entries.get(pair.localCandidateId as string) as CandidateStats | undefined
  const remote = entries.get(pair.remoteCandidateId as string) as CandidateStats | undefined
  if (!local || !remote) return 'unknown'

  const direct = (c: CandidateStats) => c.candidateType === 'host' || c.candidateType === 'prflx'
  if (!direct(local) || !direct(remote)) return 'remote'

  const remoteAddress = remote.address ?? remote.ip
  const localAddress = local.address ?? local.ip
  // A browser may leave out a host candidate's address; a host candidate needs no NAT
  if (!remoteAddress) return remote.candidateType === 'host' ? 'local' : 'unknown'
  if (isLocalAddress(remoteAddress)) return 'local'
  if (localAddress && sameIpv6Network(localAddress, remoteAddress)) return 'local'
  return 'remote'
}
