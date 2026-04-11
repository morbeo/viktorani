# ADR-0013 — Remove reveal.js and gun from package.json

**Date:** 2026-04-11
**Status:** Accepted

## Context

`vite build` reported a chunk larger than 500 kB. Analysis showed that `reveal.js`
(~300 kB) and `gun` (~180 kB) were listed in `package.json` but never imported
anywhere in `src/`. Vite bundled them eagerly, inflating every page load.

- `reveal.js`: planned for GM question display (ADR-0005) but never implemented;
  the GM uses custom React components instead.
- `gun`: declared as a CDN global (`declare const Gun` in `GunTransport.ts`); the
  package entry was redundant.

## Decision

Remove both packages from `package.json` dependencies. `GunTransport.ts` continues
to rely on the CDN-loaded `Gun` global; no import statement was ever present.

## Consequences

- Initial bundle reduced by ~480 kB before route splitting.
- `GunTransport` is unchanged — it uses `declare const Gun` and loads Gun.js at
  runtime via the CDN script tag (or a future lazy import).
- The `<meta name="description">` in `index.html` no longer references Reveal.js.
- ADR-0005 is superseded.
