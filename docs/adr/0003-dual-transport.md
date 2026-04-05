# ADR-0003 — Dual multiplayer transport: PeerJS (WebRTC) and Gun.js

**Date:** 2025-04-05
**Status:** Accepted

## Context

With no backend, multiplayer communication between the host device and player devices requires a peer-to-peer mechanism. WebRTC is the standard browser API for direct browser-to-browser data channels, but it requires a signaling step to exchange connection offers — two browsers cannot find each other without a third party introducing them, even briefly.

The application must work in bar environments where internet connectivity may be intermittent. Once players have joined, the game must continue without depending on an external server. The signaling step only happens at connection time.

## Decision

The application implements two transport backends behind a unified `ITransport` interface (`src/transport/types.ts`), managed by `TransportManager` (`src/transport/index.ts`):

**Option A — PeerJS:** Uses the PeerJS library and its free public signaling server to establish WebRTC data channels. After the handshake, all data flows directly browser-to-browser. The host's Room ID is prefixed with `vkt-` and registered with PeerJS on game start.

**Option B — Gun.js with SEA encryption:** Uses Gun.js's decentralised relay network. All game events are encrypted with SEA (Security, Encryption, Authorization) using a shared secret derived from the room passphrase and Room ID before being written to any relay. Players decode events using the same passphrase, embedded in the QR code join URL.

The `TransportManager` supports three modes: `peer` (PeerJS only), `gun` (Gun.js only), and `auto` (try PeerJS with an 8-second timeout, fall back to Gun.js). Mode is configurable per game in the game creation wizard.

## Alternatives considered

**PeerJS only:** Simpler implementation. Rejected because a single point of failure (PeerJS free tier) would make the application unavailable when the service is down. The free PeerJS server has historically been reliable but has no SLA.

**Gun.js only:** No dependency on PeerJS infrastructure. Rejected as the sole option because Gun.js relay data is written to public shared nodes; even with SEA encryption, the dependency on relay availability is a concern. Gun.js is also a heavier dependency for the common case where PeerJS works.

**Self-hosted signaling server:** Would eliminate the dependency on third-party services entirely. Rejected because it contradicts the zero-infrastructure requirement (ADR-0001). Can be added as a future option.

**No multiplayer:** A single-device mode where the host controls everything. This mode is still supported as a fallback when neither transport connects, but it is not the primary use case.

## Consequences

Both transports expose identical `connect`, `disconnect`, `send`, and `onEvent` methods, so game logic is transport-agnostic. The `auto` mode provides resilience without user intervention. Gun.js passphrase generation (`generatePassphrase` in `src/transport/index.ts`) produces a 4-word human-readable phrase that the host can read aloud if QR scanning fails. The passphrase is embedded in the join URL query string (`?t=gun&p=word-word-word-word`) so scanning is the zero-friction path.

The `transportType` exposed by `TransportManager` allows the GM interface to surface which transport is active.
