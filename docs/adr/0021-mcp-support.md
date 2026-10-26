# ADR 0021 — MCP support

**Date:** 2026-10-16
**Status:** Accepted (2026-10-24)
**Deciders:** Vladimir Kirov

---

## Context

Hosts want to use an AI assistant to prepare and run trivia nights: write a question bank,
build rounds and games, and during play read buzzes, rule on answers and keep score. The
[Model Context Protocol](https://modelcontextprotocol.io) (MCP) is the common way to give an
assistant such tools.

MCP clients talk to a server over stdio (a local process) or Streamable HTTP. Viktorani has
neither: it is static files on GitHub Pages (ADR 0001), all data is in the host browser's
IndexedDB (ADR 0002), and a browser tab cannot listen for connections. So "add an MCP server"
has to answer **where the server runs and how it reaches the data**.

Two very different jobs need tools:

| Job       | Data it touches                                            | Needs the live game? |
| --------- | ---------------------------------------------------------- | -------------------- |
| Authoring | difficulties, tags, questions, rounds, games, layouts      | No                   |
| Live play | game status, current question, buzzes, scores, timers, log | Yes, in the GM's tab |

Options considered:

1. **Node MCP server over snapshot files.** A stdio server reads and writes the JSON backup
   format (`DatabaseSnapshot`, validated by `snapshot-schema.ts`). The host imports the file in
   Settings → Data. Offline, no app changes, but authoring only.
2. **WebMCP in the host tab.** The page registers tools with the browser
   (`navigator.modelContext`, a W3C community group draft). No server, no CSP change, and the
   tools run where the data and the transport already are. Only works in browsers or extensions
   that implement it; at the time of writing this is experimental.
3. **Local bridge.** A stdio server for the client plus a WebSocket on `localhost` that the GM's
   tab connects to. Works with any MCP client today, but needs a CSP `connect-src` change, a
   pairing step so other local processes can't drive the game, and Safari blocks it.
4. **Server joins as a PeerJS peer.** Reuses the existing transport, but needs WebRTC in Node
   and a new privileged peer role, which inverts "the host is the only writer".

---

## Decision

Build MCP support in three steps, sharing one tool layer.

- **Shared tool layer, `src/mcp/`.** Each tool is a plain object: name, description, Zod input
  schema, and a handler that calls the existing `db/` helpers (and, for live tools, the GM's
  game state and `TransportManager`). It imports nothing MCP-specific, so it is unit-tested with
  `fake-indexeddb` like the rest of `db/`. Input schemas reuse `snapshot-schema.ts` and
  `transport/messages.ts` limits.
- **Step 1 — authoring server (option 1).** A `viktorani-mcp` stdio server built from the same
  sources (separate Vite/tsup entry, not part of the PWA bundle). It loads a snapshot file into
  Dexie on `fake-indexeddb`, runs authoring tools against it, and writes the snapshot back, so
  every write goes through the same code and migrations as the app. Tools: list and search
  questions; create, update and delete questions, tags and difficulties; build rounds; create a
  game from rounds; create and edit layouts (with their widgets) and themes; import questions
  in the existing JSON format; validate a snapshot. Changes stay in memory until the assistant
  calls `save`, which writes to the loaded file or a new path. Resources expose the question
  bank, games, layouts and themes read-only. It ships as one `viktorani-mcp.js` attached to
  each GitHub release, and runs from a clone with `npm run mcp`; it is not published to npm.
- **Step 2 — live tools via WebMCP (option 2).** The GameMaster page registers live tools only
  when `navigator.modelContext` exists and the host turned on **Settings → AI tools**. Tools:
  read game state, scoreboard and log; next/previous question; lock and unlock the buzzer; rule
  on a buzz; adjust a score; start, pause and reset timers; post a message. Each tool is a thin
  call into the same handlers the GM's buttons use, so state updates still happen in
  event-handler context and transport fan-out is unchanged.
- **Option 3 is deferred** until WebMCP support proves too thin in practice; the tool layer
  makes it a transport swap, not a rewrite. **Option 4 is rejected.**

Safety rules for every tool:

- Off by default; the host opts in per device. The GM view shows when AI tools are active.
- Destructive or game-ending actions (delete, end game, kick a player, import that overwrites)
  require a confirmation the host clicks in the app, never one the assistant can give itself.
- Inputs are validated with Zod before touching Dexie; payload sizes follow the transport
  limits.
- Tools expose what the GM already sees. Player device ids and peer ids are never returned.
- Live tools respect `lib/rate-limit.ts` so an assistant loop can't flood players.

---

## Consequences

- Authoring works with any MCP client today, offline, without touching the deployed app.
- The handoff for authoring is a file: the host imports it. `importDatabase` upserts by id, so
  importing edits made by the server is safe for existing rows but never deletes. Deletions
  arrive through a **replace** import: Settings → Data lists what the file lacks and removes it
  only after the host confirms (#518).
- Live control depends on WebMCP maturing. Until then, an assistant can only prepare a game.
- The server and the app must agree on the snapshot version; the server refuses versions it
  doesn't know, as `importDatabase` does.
- A new `src/mcp/` folder, a `bin` entry and a second build target add maintenance. The tool
  layer must stay free of React so it can run in Node.
- New ADRs will be needed if option 3 is adopted (CSP and pairing) or if tools move into a
  separate package.

---

## Decisions (2026-10-24)

Accepted with these answers to the open questions: replace import with a removal preview
(not a merge report); explicit `save` rather than autosave; a release asset and `npm run mcp`
rather than an npm package; and step 1 covers layouts and themes as well as the question bank,
rounds and games. Notes stay out. Work is tracked in epic #517.

## Decisions (2026-10-26)

Step 2: the live tools cover the full list above plus ending the game and kicking a player;
only those two wait for the host's click, while rulings, scores, timers and messages happen at
once and show in the game log. No origin trial token: WebMCP needs Chrome's
`#enable-webmcp-testing` flag for now. The app also offers the authoring tools through WebMCP
on the admin pages other than the game master (#532), on its own data rather than a backup
file: the file tools are left out, settings come from the device, and every delete waits for
the host's click. `viktorani-mcp` stays for assistants outside the browser. WebMCP's current draft uses `document.modelContext` and
`registerTool(tool, { signal })` with no `unregisterTool`; the app accepts both drafts.

A browser assistant that can click the page could also click **Allow**, and player names reach
the assistant as text it may take for instructions. Neither can be closed by the app; the host
guide says so, and the tools stay off until the host turns them on.

---

## Plan

1. `feat(db)`: replace-mode or merge report for `importDatabase`.
2. `feat(mcp)`: `src/mcp/` tool layer with authoring tools and tests.
3. `feat(build)`: `viktorani-mcp` stdio server entry, README section with client config.
4. `feat(admin)`: Settings → AI tools toggle and in-app confirmation for destructive tools.
5. `feat(gamemaster)`: WebMCP registration of live tools behind feature detection.
6. `chore(docs)`: host guide section on using an assistant.
