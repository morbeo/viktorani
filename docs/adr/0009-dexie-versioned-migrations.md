# ADR-0009 — Database: Dexie.js with versioned migrations

**Date:** 2026-04-10
**Status:** Accepted

## Context

All application data — questions, games, rounds, players, scores, buzz events — must
be stored locally in the browser. The project has no backend (ADR-0001), so
server-side databases are out of scope. The storage layer must support:

- Structured, queryable data (not just key-value blobs).
- Versioned schema migrations that run automatically on upgrade.
- React integration without excessive boilerplate.
- A test-friendly API (mockable in Vitest without a real browser).

IndexedDB is the only browser API that provides a full transactional database.
The question is which abstraction to use on top of it.

## Decision

We use **Dexie.js** as the IndexedDB abstraction, with all schema definitions
and migrations in a single `ViktoraniDB` class in `src/db/index.ts`.

Schema evolution uses Dexie's versioned `.version(n).stores({...}).upgrade(tx => ...)`
pattern. Each version declares the full index set for every table (Dexie requires this)
and an optional upgrade callback for data migrations. Versions are append-only —
past versions are never modified.

All React components access the database via `dexie-react-hooks` (`useLiveQuery`)
or via async helpers imported from `src/db/`. The database is exposed as a
module-level singleton (`export const db = new ViktoraniDB()`).

For testing, `fake-indexeddb` polyfills the IndexedDB API in the Vitest environment
(see ADR-0010).

## Alternatives considered

**Raw IndexedDB API:** Maximum control; no dependency. Rejected because the raw API
is callback-based, verbose, and difficult to use with React's asynchronous rendering
model. Schema migration code would be substantial to write and maintain.

**localForage:** A simple key-value store on top of IndexedDB. Rejected because it
does not support indexes or queries — storing structured data like questions with tag
filtering and sort-by-difficulty would require loading all records into memory.

**PouchDB:** A CouchDB-compatible database with sync capabilities. Rejected because
sync is not needed (the transport layer handles real-time state), and PouchDB's
document model and revision history add unnecessary overhead for this use case.

**SQLite via WASM (e.g. wa-sqlite, sql.js):** Full SQL in the browser. Rejected
because the WASM bundle size (~1 MB) is disproportionate for a trivia app; browser
support is still maturing; and Dexie covers all required query patterns.

## Consequences

- Schema changes require a new version number. Forgetting to increment the version
  causes Dexie to throw on open, which surfaces the mistake immediately in development.
- All tables must be declared in every version's `.stores()` call, even if unchanged.
  This is verbose but ensures the index set is always explicit.
- The `upgrade()` callback receives a Dexie transaction; long-running migrations
  (e.g. backfilling many rows) block the database open. This is acceptable for the
  current data volumes (hundreds of questions, not millions).
- `fake-indexeddb` supports Dexie out of the box, making unit tests fast and
  deterministic without a browser.
