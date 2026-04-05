# ADR-0006 — Use Vitest for unit testing

**Date:** 2025-04-05
**Status:** Accepted

## Context

The application contains pure logic that benefits from fast, isolated unit tests: transport utilities (`generatePassphrase`, `generateRoomId`, `TransportManager`), database seeding and snapshot import/export, UI component behaviour, and client-side routing. Tests must run in CI on every PR and on every push to `master`.

## Decision

We use Vitest as the test runner, configured directly in `vite.config.ts` via the `test` key. The test environment is `jsdom` for DOM simulation. React components are tested with `@testing-library/react`. IndexedDB is polyfilled with `fake-indexeddb`. Two TypeScript configs separate app and test compilation: `tsconfig.app.json` excludes `src/test/`; `tsconfig.test.json` includes only `src/test/` and adds `vitest/globals` via a `globals.d.ts` shim.

## Alternatives considered

**Jest:** The established standard. Rejected because Vitest is native to the Vite ecosystem, shares the same transform pipeline, and requires no additional Babel configuration. Jest with Vite requires `babel-jest` and a separate transform configuration that often lags behind Vite's module handling.

**Playwright / Cypress (E2E only):** Full browser automation for integration testing. Not rejected — E2E tests are a future addition — but they cannot replace unit tests for fast feedback on pure logic. The two approaches are complementary.

**No tests:** Rejected. The transport fallback logic, DB idempotency guards, and snapshot versioning check are non-trivial and have already caught one real bug (the `seedDefaults` guard was checking `categories.count()` instead of `difficulties.count()`).

## Consequences

Tests run via `npm run test` (single run) or `npm run test:watch` (development). Coverage is collected with `@vitest/coverage-v8` via `npm run test:coverage`. The pre-commit hook runs the full test suite before every commit, so a failing test blocks the commit locally and in CI. Page-level components are excluded from coverage targets because they are integration surfaces better suited to E2E testing.
