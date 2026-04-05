# Viktorani

Bar trivia PWA with WebRTC multiplayer, Reveal.js slides, and buzzer gameplay.
No backend — runs entirely in the browser.

**Live:** https://morbeo.github.io/viktorani/

---

## Contents

- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Multiplayer](#multiplayer)
- [Data storage](#data-storage)
- [CI/CD](#cicd)
- [Favicon & icons](#favicon--icons)
- [Contributing](#contributing)

---

## Tech stack

| Layer         | Library                      |
| ------------- | ---------------------------- |
| UI            | React 19 + TypeScript        |
| Styling       | Tailwind CSS v4              |
| Build         | Vite 8                       |
| PWA           | vite-plugin-pwa              |
| Presentation  | Reveal.js                    |
| Storage       | Dexie.js (IndexedDB)         |
| Multiplayer A | PeerJS (WebRTC)              |
| Multiplayer B | Gun.js + SEA encryption      |
| Routing       | React Router v7 (HashRouter) |

---

## Getting started

```bash
git clone https://github.com/morbeo/viktorani.git
cd viktorani
npm install --legacy-peer-deps   # legacy flag needed until vite-plugin-pwa supports Vite 8
npm run dev
```

> **Note:** `--legacy-peer-deps` is a temporary workaround while `vite-plugin-pwa` updates
> its peer dependency range for Vite 8. Remove the flag once resolved.

### Available scripts

| Script                  | What it does                                   |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Start dev server at `localhost:5173`           |
| `npm run build`         | Type-check + production build → `dist/`        |
| `npm run lint`          | ESLint across all `*.ts` / `*.tsx` files       |
| `npm run typecheck`     | Type-check app and test files (both tsconfigs) |
| `npm run test`          | Run unit tests once via Vitest                 |
| `npm run test:watch`    | Run tests in watch mode                        |
| `npm run test:coverage` | Run tests with V8 coverage report              |
| `npm run preview`       | Serve the production build locally             |

---

## Project structure

```
src/
├── db/
│   ├── index.ts          # Dexie schema — all 14 collections
│   └── snapshot.ts       # JSON export / import
├── transport/
│   ├── types.ts          # GameEvent / PlayerEvent interfaces
│   ├── PeerJSTransport.ts
│   ├── GunTransport.ts   # SEA-encrypted Gun.js relay
│   └── index.ts          # TransportManager — auto-detect + manual override
├── hooks/
│   └── useTransport.ts
├── components/
│   ├── AdminLayout.tsx
│   └── ui/index.tsx      # Button, Card, Input, Modal, Badge…
├── pages/
│   ├── admin/            # Dashboard, Questions, Games, GameMaster, Layouts, Notes, Settings
│   └── player/           # Join, Play
├── test/
│   ├── setup.ts          # jsdom polyfills (fake-indexeddb, URL mocks)
│   ├── transport.test.ts
│   ├── db.test.ts
│   ├── ui.test.tsx
│   ├── routing.test.tsx
│   └── questions-search.test.ts
└── App.tsx               # HashRouter + all routes

public/
├── favicon.svg           # SVG favicon (source of truth)
├── icon-192.png          # PWA icon — generate from favicon.svg (see Favicon section)
└── icon-512.png          # PWA icon — generate from favicon.svg
```

---

## Multiplayer

No backend server. Two transport options, selectable per game:

| Mode       | Mechanism                                        | Internet required      |
| ---------- | ------------------------------------------------ | ---------------------- |
| **PeerJS** | WebRTC via PeerJS signaling                      | Initial handshake only |
| **Gun.js** | Decentralised relay + SEA encryption             | Initial handshake only |
| **Auto**   | Tries PeerJS (8s timeout) → falls back to Gun.js | Initial handshake only |

The host generates a **Room ID** and (for Gun.js) a **4-word passphrase**. Both are embedded
in the QR code that players scan. After the initial connection, all game state flows
browser-to-browser with no server involvement.

### Gun.js encryption

Data on public Gun.js relays is encrypted using
[SEA](https://gun.eco/docs/SEA) (Security, Encryption, Authorization) with a
shared secret derived from the passphrase + Room ID. The passphrase is displayed
large on the Game Master screen so the host can read it aloud if QR scanning fails.

---

## Data storage

All data lives in **IndexedDB** (via Dexie.js) on the host device. Nothing is sent to
any server.

**Collections:** categories, difficulties, tags, questions, rounds, games, teams, players,
buzzEvents, layouts, widgets, notes, timers, gameQuestions.

**Backup:** export a full JSON snapshot from the Dashboard. Import it on any device to
restore or share your question bank.

---

## CI/CD

### Workflows

| Workflow     | Trigger                   | Purpose                                                        |
| ------------ | ------------------------- | -------------------------------------------------------------- |
| `ci.yml`     | PRs to `master`           | Type-check, lint, test, build — blocks merge if any step fails |
| `deploy.yml` | push to `master` + manual | Type-check → lint → **test** → build → deploy to GitHub Pages  |

Both workflows set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to opt into the Node 24 runner ahead of the June 2026 forced migration.

A push to `master` only deploys if all four gates pass. Dependabot PRs run through `ci.yml` automatically before merge.

### Versioning

[Conventional commits](https://www.conventionalcommits.org/) drive automatic versioning:

| Commit prefix                 | Version bump    |
| ----------------------------- | --------------- |
| `feat:`                       | minor (`0.x.0`) |
| `fix:`, `perf:`               | patch (`0.0.x`) |
| `feat!:` / `BREAKING CHANGE:` | major (`x.0.0`) |

release-please accumulates commits into a release PR. Merging it tags the release,
publishes a GitHub Release with the changelog, and triggers a deploy.

### One-time setup: `RELEASE_PAT`

release-please needs a fine-grained PAT to create PRs (GitHub blocks `GITHUB_TOKEN` from
doing this by policy):

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained**
2. Scope to the `viktorani` repository
3. Permissions: **Contents** (read + write), **Pull requests** (read + write)
4. Copy the token → repo **Settings → Secrets → Actions → New secret: `RELEASE_PAT`**

---

## Favicon & icons

The source of truth is `public/favicon.svg`. From it, generate the PNG icons needed
by the PWA manifest and Apple devices:

```bash
# Using sharp-cli (install once)
npm install -g sharp-cli

sharp -i public/favicon.svg -o public/icon-192.png resize 192
sharp -i public/favicon.svg -o public/icon-512.png resize 512
```

Or use [Squoosh](https://squoosh.app) / [RealFaviconGenerator](https://realfavicongenerator.net)
to generate them manually and drop them into `public/`.

The `index.html` uses `%BASE_URL%` so paths resolve correctly under `/viktorani/`
on GitHub Pages and at `/` in dev.

---

## Testing

**90 unit tests** across four suites, run with [Vitest](https://vitest.dev) + jsdom + Testing Library.

| Suite            | File                       | What it covers                                                                                                                           |
| ---------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Transport        | `transport.test.ts`        | `generatePassphrase`, `generateRoomId`, `TransportManager` (all modes, fallback, events, listeners)                                      |
| Database         | `db.test.ts`               | `seedDefaults` (idempotency, guard, seed values), schema CRUD, indexes, snapshot import/export, question bulk import/export              |
| UI components    | `ui.test.tsx`              | Button, Badge, Card, Input, Textarea, Select, Modal, Empty, TransportPill                                                                |
| Routing          | `routing.test.tsx`         | All routes render the correct page, unknown routes redirect to `/admin`                                                                  |
| Questions search | `questions-search.test.ts` | Fuzzy search across all fields (title, answer, options, category, difficulty, tags, description), hard filters, select-all matched logic |

Tests run on every commit locally (pre-commit hook) and on every push to `master` (deploy workflow gate).

```bash
npm run test            # run once
npm run test:watch      # watch mode during development
npm run test:coverage   # coverage report → coverage/lcov.info
```

Two tsconfigs keep app and test types separate:

- `tsconfig.app.json` — excludes `src/test/`, no vitest globals
- `tsconfig.test.json` — includes only `src/test/`, adds `vitest/globals` and `@testing-library/jest-dom`

---

## Contributing

1. Fork → branch off `master`
2. Follow conventional commits (`feat(scope): description`)
3. Pre-commit hooks (husky) run lint-staged (ESLint + Prettier on staged files), typecheck, and the full test suite automatically
4. PR title must pass conventional commit lint (checked by `pr-title.yml`)
5. Open PR against `master`

### Commit scopes

`admin` · `player` · `transport` · `db` · `ui` · `pwa` · `deps` · `release`
