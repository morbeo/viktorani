# Coverage Notes

Files with intentionally low coverage, tracked here until their epics are complete.
CI enforces **global** thresholds only — no per-file gates.

## Known-low files

| File | Stmts | Reason | Tracking |
|---|---|---|---|
| `hooks/useBuzzer.ts` | ~2% | Buzzer epic not yet implemented — WebRTC adjudication logic lives here but has no unit-testable surface until the GM control system is wired up | Buzzer epic |
| `db/index.ts` | ~46% | Low-level Dexie helpers; untested paths are legacy migration scaffolding and emergency purge routines that require real IndexedDB environments | — |

## Annotation conventions

Use `/* c8 ignore next */` for a single uncovered line:
```ts
/* c8 ignore next */
if (process.env.NODE_ENV === 'test') return
```

Use `/* c8 ignore start */` / `/* c8 ignore stop */` for a block:
```ts
/* c8 ignore start */
// WebRTC teardown — untestable without a real peer connection
peer.destroy()
/* c8 ignore stop */
```

These annotations suppress v8 coverage for those lines so they do not
drag down thresholds. Add a comment explaining *why* the block is excluded.

## Thresholds (vite.config.ts)

| Metric | Threshold |
|---|---|
| Statements | 80% |
| Lines | 80% |
| Functions | 80% |
| Branches | 75% |

Branches are set slightly lower because JSX ternaries and optional chaining
generate branch entries that are rarely all exercised in unit tests.
