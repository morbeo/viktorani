# ADR 0018 — Sending layouts to remote surfaces

**Date:** 2026-10-15
**Status:** Accepted
**Deciders:** Vladimir Kirov

---

## Context

Players' phones and remote projector screens render through `LayoutRenderer` (ADR 0017),
but they have no database of the host's: until now they always used the built-in default.
The host's stored layouts have to reach them over the transport (#411). A layout comes from
the host, but whatever arrives on a data channel is untrusted, so a layout must not be a way
to run script, load arbitrary content or exhaust a phone's memory.

---

## Decision

- **One `LAYOUT` event per surface kind.** It names the target (`player`, `screen`, or
  `scoreboard` for a scoreboard display on another device), the game, and a list of layouts
  with their widgets.
- **Each phase's pick, not just the current one.** The host sends, for every game phase and
  for "all phases", the layout `resolveLayout` would pick, without duplicates
  (`layoutsForPhases`). The surface resolves among them for its own phase, which gives the
  same answer as resolving among everything stored. So the surface switches as soon as it
  learns the phase changed, and the ended layout still shows after the host closes every
  connection at the end of the game. A phase change needs no resend.
- **Resent on admit and on change.** A player gets it when admitted, and so on every rejoin;
  a screen when approved. Both get it again whenever the stored layouts change. No stored
  layout that fits means an empty list, and the surface keeps its built-in default.
- **Strict schema, then the registry.** The wire schema is strict at every level: ids and
  names are bounded, targets, phases and widget types are enums, grid rects must sit on the
  grid, colours are `#rrggbb`, the font scale is bounded, and the logo is a `data:image/` or
  `https://` URL, as for stored layouts and question media. Widget configs are bounded
  records, checked against their type's schema by `isRenderable` before anything renders;
  a layout that fails is skipped like an invalid stored one. Layouts carry no HTML, CSS or
  free-form URLs, and the renderer only sets numbers and colours as inline styles. The text
  widget's text is bounded plain text, rendered as such; the image widget's address follows
  the logo's rule (`data:image/` or `https://`, bounded) and loads with no referrer.
- **Size caps.** At most one layout per phase plus one, 64 widgets each, 32 config keys per
  widget, and 3,000,000 characters for the whole event, about one logo at its own limit. The
  host builds the event to pass the same schema: when logos make it too large it leaves them
  out, then if need be the image widgets' `data:` addresses, and when it still doesn't pass
  it sends no layouts.

---

## Consequences

- Remote surfaces follow the host's stored layouts with no change to the pages beyond
  passing them to `resolveLayout`.
- Phase-based switching (#414) only has to make the surfaces' phase richer than "ended or
  not"; the layouts for every phase are already there.
- An `https://` logo is fetched by every phone and screen, which tells that server their
  addresses. It is the same trade-off as `https://` question media; a `data:` logo avoids it.
  The same goes for an image widget's `https://` address.
