# ADR-0010 — PWA / offline-first strategy

**Date:** 2026-04-10
**Status:** Accepted

## Context

Viktorani is designed for bar and pub environments where Wi-Fi is unreliable and
mobile data is often congested. The host device must be able to run the GM view
without any internet connection once the app is loaded. Players who have visited
the site before should also be able to load the join page without connectivity.

Additionally, the app should be installable as a home-screen icon on the host's
tablet or laptop, behaving like a native app (no browser chrome, standalone window).

## Decision

We build Viktorani as a **Progressive Web App (PWA)** using `vite-plugin-pwa`,
which generates a service worker and a Web App Manifest automatically from Vite's
build output.

**Service worker strategy:** `GenerateSW` with a `workbox` `StaleWhileRevalidate`
strategy for all assets. On first visit, all build artifacts are cached. On subsequent
visits, the cached version is served immediately while the new version is fetched in
the background. On next reload, the updated version is active.

**Manifest:** Declares `display: standalone`, a 192×192 and 512×512 PNG icon set,
and a `start_url` of `/viktorani/` (matching the GitHub Pages subpath).

**Offline capability scope:**

- The GM can run a full game offline: questions, navigation, buzzer logic, and scoring
  all work without any network request.
- The real-time transport (PeerJS / Gun.js) requires internet for initial connection.
  Once the game is in progress, PeerJS direct data channels survive brief connectivity
  drops; Gun.js buffers events and replays on reconnect.
- Player devices need internet for the initial page load; after caching they can
  reload offline but will not receive transport events without connectivity.

**Peer conflict:** `vite-plugin-pwa` declares a peer dependency on a specific Vite
major version. With Vite 8, this peer constraint is satisfied via an npm `overrides`
block in `package.json` rather than downgrading Vite.

## Alternatives considered

**No service worker (plain static site):** Simpler build. Rejected because offline
operation is a primary design requirement — bar Wi-Fi is notoriously unreliable.

**Manual service worker:** Full control over caching strategy. Rejected because
Workbox (used by `vite-plugin-pwa`) handles cache versioning, update detection, and
the `skipWaiting` / `clientsClaim` lifecycle correctly out of the box. Writing this
manually would be substantial and error-prone.

**Capacitor / Electron (native wrapper):** True offline native app. Rejected because
it would require a build and distribution pipeline (App Store, DMG/EXE) that
contradicts the zero-cost, zero-maintenance deployment goal. A PWA achieves
install-to-home-screen on iOS/Android/desktop without any store submission.

## Consequences

- The host must load the app at least once on a network-connected device before
  going offline. This is a reasonable requirement for a planned event.
- Service worker updates are silent (StaleWhileRevalidate). If the host wants to
  pick up a new version immediately, they need to close all tabs and reopen, or
  use the browser's "Update" prompt if one appears.
- The `display: standalone` manifest requires `HashRouter` instead of `BrowserRouter`
  because GitHub Pages cannot serve arbitrary deep paths (see ADR-0004).
- PWA install prompts behave differently across browsers and OS versions. Chrome on
  Android and Edge on desktop show an install prompt; Safari on iOS requires the user
  to manually "Add to Home Screen" from the share sheet.
