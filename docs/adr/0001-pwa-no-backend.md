# ADR-0001 — Host as a PWA with no backend

**Date:** 2025-04-05
**Status:** Accepted

## Context

Viktorani is a bar trivia platform originally designed around PocketBase as a backend (see Buzzaro reference design). The goal is to host it freely and indefinitely with zero running costs, zero server maintenance, and zero infrastructure for the host to manage. The target deployment is GitHub Pages, which serves only static files.

A backend would require a hosted server, a managed database, and ongoing maintenance. For a bar trivia tool used occasionally, this overhead is disproportionate. The question was whether the full feature set — question bank, game sessions, real-time buzzer, scoring — could be delivered without any server.

## Decision

We deploy Viktorani as a static Progressive Web Application on GitHub Pages. There is no backend, no database server, and no API. All data is stored in the browser using IndexedDB (via Dexie.js). The app is installable on any device via the PWA manifest.

## Alternatives considered

**PocketBase (original Buzzaro design):** A self-hosted BaaS providing SQLite, auth, real-time SSE, and file storage. Rejected because it requires a running server, which contradicts the zero-cost, zero-maintenance requirement. PocketBase could be revisited if the project grows to need multi-host accounts or server-side persistence.

**Firebase / Supabase:** Managed cloud backends. Both introduce vendor dependency, potential costs at scale, and data leaving the user's device. Rejected for the same reasons as PocketBase, with the additional concern of privacy and lock-in.

**No backend with limited features:** A subset of the design that avoids any real-time features entirely. Rejected because the buzzer and multiplayer are central to the product's value.

## Consequences

All data lives on the host's device. There is no account system. Sharing question banks between devices requires explicit JSON export/import (implemented in `src/db/snapshot.ts`). The PWA can be used offline once cached, which is a positive for bar environments with poor connectivity. The trade-off is that data loss on device wipe is the user's responsibility.

GitHub Pages requires `HashRouter` instead of `BrowserRouter` because it cannot serve arbitrary paths — all routing happens client-side via the URL hash fragment.
