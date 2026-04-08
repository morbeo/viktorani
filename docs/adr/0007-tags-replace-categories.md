# ADR-0007 — Tags replace categories as the sole question classifier

**Date:** 2026-04-08
**Status:** Accepted

## Context

Questions had two overlapping classification systems: **categories** (a single required classifier per question — "Geography", "Science", etc.) and **tags** (a multi-value set for additional labelling). Both were colour-coded, both appeared in the UI, and both had their own Settings management panels. Users had to decide which concept applied to each label they wanted to create, with no clear rule distinguishing a "category" from a "tag".

This redundancy created friction in two ways:

1. **Authoring**: adding a question required picking a category from a dropdown _and_ optionally selecting tags. The category dropdown's single-select constraint forced an arbitrary primary/secondary split that tags already express more flexibly.
2. **Filtering**: the Questions page had a category dropdown filter and a tag toggle area, but no way to combine them coherently (e.g. "exclude all Science questions").

## Decision

Remove the `Category` type, the `categories` IndexedDB table, the `categoryId` field on `Question`, and the `ManageCategories` settings panel. Tags become the sole classification mechanism.

Filtering is upgraded to **tri-state per tag** — each tag pill cycles through `none → include → exclude`. Include means "must have this tag"; exclude means "must not have this tag". Multiple includes are conjunctive (AND); multiple excludes are also conjunctive (none of these). Includes and excludes combine.

The DB is migrated to version 3 with a Dexie upgrade step that strips `categoryId` from existing question records. The snapshot format is bumped to version 2 (categories field dropped); version 1 imports remain supported with categories silently ignored and `categoryId` stripped from question records.

## Alternatives considered

**Keep categories as a required single-select classifier, add tri-state tag filters**: Retains the UI complexity without solving the duplication. Users still have to manage two lists.

**Keep categories, make them optional**: Reduces friction slightly but doesn't eliminate the duplication or the confusing "what goes where" question.

**Use a single flat tag list but add a "primary tag" concept**: Unnecessarily complex; the ordering and display weight of tags can be controlled via the Settings panel sort order without a dedicated field.

## Consequences

- `Question.categoryId` is removed from the TypeScript type and the DB schema. Existing data is migrated automatically on first open after the upgrade.
- `ManageCategories` is deleted; tags are managed via the expanded `ManageTags` panel in Settings.
- The Questions toolbar gains a tag filter bar with tri-state pills. The category dropdown filter is removed.
- Snapshot version bumped to 2. The `importDatabase` function accepts v1 files and strips any `categoryId` fields transparently.
- The fuzzy search `_categoryName` field is removed from enriched search documents; tag-name search already covers the same queries.
- Tests for category CRUD (`settings.test.tsx`) are replaced by equivalent tag CRUD tests. `questions-search.test.ts` gains a dedicated `tri-state tag filters` describe block.
