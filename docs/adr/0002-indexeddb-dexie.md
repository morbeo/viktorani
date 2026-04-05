# ADR-0002 — Use IndexedDB via Dexie.js for local data storage

**Date:** 2025-04-05
**Status:** Accepted

## Context

With no backend (see ADR-0001), all application data — questions, rounds, games, players, scores — must persist locally on the host's device across sessions. The browser offers two primary storage mechanisms for structured data: `localStorage` and `IndexedDB`. The data model is relational and non-trivial: 14 collections with foreign-key-style relationships between games, rounds, questions, teams, players, and events.

## Decision

We use IndexedDB as the storage engine, accessed through Dexie.js as a typed wrapper. The schema is defined once in `src/db/index.ts` and versioned via Dexie's migration system. All collections are typed with TypeScript interfaces exported from the same file.

## Alternatives considered

**localStorage:** Simple key-value store with a synchronous API. Unsuitable because the 5–10 MB storage limit is too small for a question bank with base64-encoded media, and the lack of indexing makes relational queries impractical. Also synchronous, which blocks the main thread.

**Plain IndexedDB API:** Would work but requires verbose boilerplate for every read and write operation. Dexie provides a Promise-based API, TypeScript generics for type safety, and a clean query DSL that significantly reduces code volume without adding meaningful overhead.

**SQLite via WASM (e.g. sql.js, Origin Private File System):** More powerful query capabilities. Rejected because it adds significant bundle size (~1 MB for WASM binary), has limited browser support for the persistence layer, and the query flexibility is not needed for this schema.

## Consequences

The Dexie schema must be versioned with explicit migration steps when the data model changes. Breaking schema changes require a version bump and migration in `src/db/index.ts`. The `seedDefaults` function populates initial difficulties and tags on first load; it guards on `difficulties.count() > 0` to remain idempotent. JSON snapshot export/import (`src/db/snapshot.ts`) provides the only cross-device data portability.
