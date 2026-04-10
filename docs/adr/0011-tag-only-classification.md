# ADR-0011 — Tag-only question classification

**Date:** 2026-04-10
**Status:** Accepted

## Context

See ADR-0007, which documents the decision to remove the `Category` type and make
tags the sole question classifier. This ADR records the consequences and implementation
details that were deferred from ADR-0007.

The original system had:

- **Categories** — a single required classifier per question (e.g. "Geography").
- **Tags** — an optional multi-value set for additional labels.

Both were colour-coded and managed in separate Settings panels. The duplication
created authoring friction (which label goes where?) and made filtering inconsistent.

## Decision

Remove the `Category` type entirely. Tags are the sole classifier. The filtering UI
upgrades from a single-select category dropdown to a **tri-state per-tag** model:

- **None** (default) — tag is not used as a filter criterion.
- **Include** — question must have this tag (conjunctive AND across multiple includes).
- **Exclude** — question must not have this tag (conjunctive AND across multiple excludes).

Includes and excludes compose: "must have `History` AND must not have `Hard`" is a
valid filter state.

The DB is migrated from v2 to v3 (see `src/db/index.ts`) with a Dexie upgrade step
that strips `categoryId` from all existing `questions` records and drops the
`categories` table. The snapshot format is bumped to v2 (categories field dropped);
v1 imports remain supported with categories silently ignored.

## Alternatives considered

See ADR-0007 for the full alternatives analysis.

## Consequences

- `Question.categoryId` is removed from the TypeScript schema and all DB indexes.
  Existing data is migrated automatically on first open after the upgrade.
- The `ManageCategories` settings panel is deleted. Tag management is consolidated
  into the expanded `ManageTags` panel.
- Snapshot v2 does not include a `categories` field. Importing a v1 backup on a
  v3+ database silently discards the categories array and strips `categoryId` from
  imported questions.
- Tri-state tag filtering is more expressive than the old single-select dropdown
  but requires users to understand include vs. exclude semantics. The UI communicates
  this via colour coding (green = include, red = exclude, grey = none).
- Search index no longer includes `_categoryName`. Tag names are already indexed by
  Fuse.js, so coverage is equivalent.
