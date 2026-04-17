# ADR 0014 — Drop Math Rendering Support

**Date:** 2025-04-17
**Status:** Accepted
**Deciders:** Vladimir Kirov

---

## Context

Issue #120 required an audit of markdown features rendered in note prose.
Math rendering (`$...$` / `$$...$$`) was on the list of features to evaluate.

Supporting math requires two packages:

- `remark-math` — parses math syntax in the AST
- `rehype-katex` — renders it to HTML using KaTeX

KaTeX itself is a significant dependency: its minified CSS alone is ~280 KB,
and the full bundle (fonts included) adds several hundred KB more to the
initial load. KaTeX also needs its font files served at a predictable path,
which conflicts with the GitHub Pages static hosting approach unless carefully
configured.

---

## Decision

Math rendering is **not supported** in Viktorani note prose.

If a note contains `$...$` or `$$...$$` syntax, those tokens will render as
plain text.

---

## Rationale

Bar trivia content does not require mathematical notation. The cost
(bundle size, hosting complexity, KaTeX font path configuration) is not
justified by any realistic use case for this application.

---

## Consequences

- Bundle stays lean.
- No KaTeX CSS or font files need to be served.
- Note authors who paste math notation will see raw LaTeX text — acceptable
  for the target audience.
- If math is needed in a future use case, add `remark-math` + `rehype-katex`
  with a CDN KaTeX CSS link to avoid font hosting issues.
