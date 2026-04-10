# ADR-0012 — Vitest vmForks pool for ESM compatibility

**Date:** 2026-04-10
**Status:** Accepted

## Context

The project uses `fake-indexeddb` to polyfill IndexedDB in tests. Starting with
`fake-indexeddb` v5+, the package is published as pure ESM with top-level `await`
in its module initialisation. Node.js cannot `require()` a module that contains
top-level `await` — doing so throws:

```
ERR_REQUIRE_ASYNC_MODULE
```

Vitest's default worker pool (`forks`) loads test modules via a CommonJS-compatible
require shim, which triggers this error when any test file imports `fake-indexeddb`
(directly or transitively via `src/db/`).

## Decision

DB-touching test files annotate their pool requirement at the top of the file:

```ts
// @vitest-pool vmForks
```

The `vmForks` pool runs each test file in a separate Node.js VM context using the
native ES Module loader. Top-level `await` is handled correctly in this mode.

The annotation is placed **per-file** on tests that import from `src/db/`, rather
than globally in `vite.config.ts`. This keeps non-DB tests running in the faster
default pool.

## Alternatives considered

**Set `pool: 'vmForks'` globally in `vite.config.ts`:** Simpler configuration —
no per-file annotation needed. Rejected because `vmForks` has higher startup
overhead than `forks`. Applying it globally would slow down the non-DB test suite
(transport utilities, hook unit tests) unnecessarily.

**Downgrade `fake-indexeddb` to v4:** v4 is CommonJS-compatible and works with the
default pool. Rejected because v4 is significantly behind v6 (current), lacks bug
fixes, and pinning old major versions creates upgrade friction.

**Mock `src/db/` at the module level:** Replace the real Dexie database with a
hand-written mock in all tests. Rejected because it would create a second
implementation of query logic that can drift from the real one, defeating the purpose
of integration tests.

**Use `@vitest/browser`:** Run tests in a real browser where IndexedDB is natively
available. Rejected because browser tests have much higher CI overhead (requires
Playwright) and are better suited to E2E testing than the unit/integration tests
that currently cover DB behaviour.

## Consequences

- Any new test file that imports from `src/db/` or from any hook that accesses the DB
  must include the `// @vitest-pool vmForks` annotation. Forgetting it produces the
  `ERR_REQUIRE_ASYNC_MODULE` error, which is a clear signal that the annotation is needed.
- The annotation is file-level, so a single test file cannot mix DB and non-DB
  concerns without paying the `vmForks` startup cost for all tests in the file.
  In practice this is not a constraint because DB and non-DB logic are in separate files.
- CI run times are acceptable: the vmForks overhead is ~100–200 ms per file, and
  there are currently only a handful of DB-touching test files.
