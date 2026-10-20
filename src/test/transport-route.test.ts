import { describe, it, expect } from 'vitest'
import { isLocalAddress, routeFromStats } from '@/transport/route'

type Candidate = { candidateType: string; address?: string }

/** A stats report with one selected pair, the Chrome way (through the transport entry). */
function report(local: Candidate, remote: Candidate): RTCStatsReport {
  return new Map<string, Record<string, unknown>>([
    ['T', { id: 'T', type: 'transport', selectedCandidatePairId: 'P' }],
    ['P', { id: 'P', type: 'candidate-pair', localCandidateId: 'L', remoteCandidateId: 'R' }],
    ['L', { id: 'L', type: 'local-candidate', ...local }],
    ['R', { id: 'R', type: 'remote-candidate', ...remote }],
  ]) as unknown as RTCStatsReport
}

const host = (address?: string): Candidate => ({ candidateType: 'host', address })

describe('isLocalAddress', () => {
  it.each([
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.20',
    '169.254.3.4',
    '127.0.0.1',
    'fe80::1',
    'FD12:3456::1',
    '::1',
    '3f1c2b7e-9d1a-4b8e-a0c4-5e6f7a8b9c0d.local',
  ])('%s is local', a => expect(isLocalAddress(a)).toBe(true))

  it.each(['8.8.8.8', '172.32.0.1', '100.64.0.1', '2001:db8::1', 'example.com', '1:2:3'])(
    '%s is not local',
    a => expect(isLocalAddress(a)).toBe(false)
  )
})

describe('routeFromStats', () => {
  it('is local for host candidates on a private network', () => {
    expect(routeFromStats(report(host('192.168.1.2'), host('192.168.1.9')))).toBe('local')
  })

  it('is local for an mDNS name or a peer-reflexive private address', () => {
    expect(routeFromStats(report(host('192.168.1.2'), host('abc.local')))).toBe('local')
    expect(
      routeFromStats(report(host('10.0.0.2'), { candidateType: 'prflx', address: '10.0.0.7' }))
    ).toBe('local')
  })

  it('is local for a host candidate whose address the browser hides', () => {
    expect(routeFromStats(report(host(), host()))).toBe('local')
    expect(routeFromStats(report(host(), { candidateType: 'prflx' }))).toBe('unknown')
  })

  it('compares IPv6 networks by their /64 prefix', () => {
    expect(routeFromStats(report(host('2001:db8:1:2::5'), host('2001:db8:1:2:a::9')))).toBe('local')
    expect(routeFromStats(report(host('2001:db8:1:2::5'), host('2001:db8:9:9::9')))).toBe('remote')
  })

  it('is remote through a NAT, a relay or to a public address', () => {
    const lan = host('192.168.1.2')
    expect(routeFromStats(report(lan, { candidateType: 'srflx', address: '203.0.113.5' }))).toBe(
      'remote'
    )
    expect(
      routeFromStats(report({ candidateType: 'relay', address: '10.0.0.1' }, host('10.0.0.2')))
    ).toBe('remote')
    expect(routeFromStats(report(lan, host('203.0.113.5')))).toBe('remote')
  })

  it("finds Firefox's selected pair, and is unknown without one", () => {
    const firefox = new Map<string, Record<string, unknown>>([
      [
        'P',
        {
          id: 'P',
          type: 'candidate-pair',
          selected: true,
          localCandidateId: 'L',
          remoteCandidateId: 'R',
        },
      ],
      ['L', { id: 'L', type: 'local-candidate', candidateType: 'host', address: '10.0.0.2' }],
      ['R', { id: 'R', type: 'remote-candidate', candidateType: 'host', address: '10.0.0.3' }],
    ]) as unknown as RTCStatsReport
    expect(routeFromStats(firefox)).toBe('local')
    expect(routeFromStats(new Map() as unknown as RTCStatsReport)).toBe('unknown')
  })
})
