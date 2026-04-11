# ADR-0005 — Use Reveal.js for question presentation

**Date:** 2025-04-05
**Status:** Superseded by ADR-0013

## Context

The primary display surface for Viktorani is a large screen or TV showing questions to the audience. The presentation needs to support smooth transitions between questions, round titles, media (images, video, audio), and a visual hierarchy that reads from a distance. This is closer to a slide deck than a CRUD interface.

## Decision

Questions are presented using Reveal.js. Each question maps to a Reveal.js slide. The Game Master controls slide advancement; the current slide index is broadcast to player devices via the active transport (ADR-0003) so player UIs reflect the current question without a separate data fetch.

## Alternatives considered

**Custom slide component:** A hand-rolled transition system built with CSS animations. Viable but expensive to build to a comparable quality level. Reveal.js provides keyboard navigation, slide overview, speaker notes, and a variety of transition effects out of the box.

**A presentation tool (PowerPoint, Google Slides):** Pre-built question decks could be imported. Rejected because it breaks the dynamic game state model — questions must be pulled from the live database and respond to real-time GM actions (revealing answers, showing media).

**No dedicated presentation view:** Display questions in the same admin layout used for the GM. Rejected because the admin layout is dense and information-rich, not suitable for projection or audience readability.

## Consequences

Reveal.js adds to the bundle size. The GM interface embeds a Reveal.js instance and exposes controls (next, previous, jump to question). Player devices receive slide index updates via the transport layer and render a simplified view — they do not run a full Reveal.js instance themselves. The Reveal.js `base` must account for the `/viktorani/` path prefix configured in Vite (see ADR-0004).

---

## Superseded

Reveal.js was never imported in `src/` — the dependency was listed in `package.json` but the GM question display was implemented with custom React components instead. `reveal.js` was removed from `package.json` in the bundle-size reduction epic (issue #99). See ADR-0013 for the adopted approach.
