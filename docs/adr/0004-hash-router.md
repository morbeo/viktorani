# ADR-0004 — Use HashRouter for client-side routing

**Date:** 2025-04-05
**Status:** Accepted

## Context

GitHub Pages serves static files from a single directory. When a user navigates directly to `https://morbeo.github.io/viktorani/admin/questions` or refreshes the page at a deep route, GitHub Pages returns a 404 because there is no file at that path — only `index.html` at the root. React Router's default `BrowserRouter` uses the HTML5 History API (`pushState`), which requires the server to return `index.html` for all routes. GitHub Pages cannot be configured to do this without a workaround.

## Decision

We use React Router's `HashRouter`. All routes are prefixed with `#`, so the full URL for the questions page is `https://morbeo.github.io/viktorani/#/admin/questions`. The server always serves `index.html` from the root; the hash fragment is never sent to the server and is handled entirely by JavaScript.

## Alternatives considered

**BrowserRouter with a 404.html redirect hack:** GitHub Pages serves `404.html` for missing paths, which can redirect to `index.html` with the path encoded as a query string, then decoded by JavaScript. This works but is fragile, breaks on some browsers, and pollutes the URL with encoded path strings during the redirect.

**Single-page with no routing:** All state managed in memory with no URL-based navigation. Rejected because deep linking to specific pages (e.g., a direct link to a specific game's GM view) would be impossible, and browser history would not work.

**Custom domain with a proper web server:** Would allow `BrowserRouter` without any hacks. Rejected because it introduces infrastructure and cost that contradict ADR-0001.

## Consequences

All internal `<Link>` components and `navigate()` calls work as normal — React Router abstracts the hash. External links to specific pages must use the `#/` prefix. The PWA manifest's `start_url` is set to `/viktorani/` which loads `index.html` and the app's default redirect handles navigation from there. The `vite.config.ts` `base` is set to `/viktorani/` so all asset paths resolve correctly.
