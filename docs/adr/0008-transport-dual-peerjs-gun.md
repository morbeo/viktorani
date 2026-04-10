# ADR-0008 — Transport layer: dual PeerJS + Gun.js with auto-fallback

**Date:** 2026-04-10
**Status:** Accepted

## Context

Viktorani is a fully static PWA with no backend (ADR-0001). Real-time communication
between the GameMaster and players is required for the buzzer, score updates, timer
broadcasts, and question-navigation events. The transport layer must work in bar
environments where network conditions are unpredictable.

Two broad options exist for browser-to-browser real-time communication without a
custom server: WebRTC (with a signalling layer) and relay-based pub/sub.

**Constraints:**

- Zero server maintenance — no custom signalling or relay server to run.
- Must work behind restrictive NATs (common in pubs and venues).
- Latency must be low enough for fair buzzer ordering (< 100 ms typical round-trip).
- The passphrase displayed on the QR code must provide confidentiality.

## Decision

We implement two transport classes behind a common `ITransport` interface:

1. **`PeerJSTransport`** — WebRTC data channels via the PeerJS cloud signalling service.
   The host registers a deterministic PeerJS ID (`vkt-<roomId>`); players connect to it.
   All data flows peer-to-peer with DTLS encryption from the browser.

2. **`GunTransport`** — Decentralised graph database relay via public Gun.js peers.
   Events are symmetrically encrypted with SEA (`SEA.work(passphrase, roomId)`) before
   being written to the Gun graph. All peers subscribe to the same namespace and decrypt
   on receive.

`TransportManager` exposes three modes:

- `'peer'` — PeerJS only.
- `'gun'` — Gun.js only.
- `'auto'` — Try PeerJS; if it times out after 8 seconds, fall back to Gun.js.

The default mode is `'auto'`.

## Alternatives considered

**PeerJS only:** Simpler implementation and lower latency. Rejected as the sole option
because the PeerJS cloud service has had availability incidents, and WebRTC peer
connections are blocked by some corporate/venue NATs.

**Gun.js only:** More reliable connectivity (relay-based, firewall-friendly). Rejected
as the sole option because Gun.js relay peers are public infrastructure with variable
latency, and the relay-hop model adds ~50–150 ms round-trip compared to PeerJS's
direct data channel.

**Socket.IO / Pusher / Ably:** Managed WebSocket services. Rejected because they
require an account, API keys, and introduce per-message costs or strict rate limits.
They also contradict the zero-server-maintenance constraint.

**WebSockets with a self-hosted relay:** Maximum control and performance. Rejected
because it requires running a server, which contradicts ADR-0001.

## Consequences

- Hosts can manually override the transport mode per-game if one option is known to
  work better at their venue.
- The 8-second PeerJS timeout is a trade-off: short enough not to delay game start
  noticeably, long enough to distinguish a slow connection from a broken one.
- Gun.js relay peers are third-party infrastructure. If both public relay servers are
  unavailable, Gun.js transport will fail. The passphrase-based SEA encryption means
  relay operators cannot read game events.
- The `ITransport` interface makes it straightforward to add future transports
  (e.g. self-hosted WebSocket, BroadcastChannel for same-device testing) without
  changing consumers.
