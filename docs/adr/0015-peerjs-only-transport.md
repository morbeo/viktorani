# ADR 0015 — PeerJS-only transport

**Date:** 2026-09-30
**Status:** Accepted
**Deciders:** Vladimir Kirov

---

## Context

ADR-0003 and ADR-0008 chose a dual transport: PeerJS (WebRTC) with a Gun.js relay
fallback in `'auto'` mode, plus a four-word passphrase used for Gun SEA encryption.

In practice the Gun transport never worked: its `Gun` / `SEA` globals were never
loaded, so `'gun'` mode failed and `'auto'` fell back to a broken transport. The
public Gun relays it pointed at are also unmaintained. Issue #244 decided to drop it.

---

## Decision

PeerJS is the only transport. `GunTransport`, the `'auto'` / `'gun'` modes, the
transport picker in the game wizard and the passphrase are removed (#265).
Players join with the room code only.

---

## Consequences

- `Game` no longer has `transportMode` or `passphrase`. Existing IndexedDB rows may
  still carry them; nothing reads them. No Dexie version bump is needed because
  neither field was indexed.
- JSON backups that include `transportMode` (`'auto' | 'peer' | 'gun'`) and
  `passphrase` still import: the import schema strips them like any unknown key.
- Hosts behind networks where WebRTC cannot connect have no relay fallback. A TURN
  server or a different relay can be revisited in a new ADR if this becomes a problem.
