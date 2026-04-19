# Viktorani

Bar trivia PWA with WebRTC multiplayer, Reveal.js slides, and buzzer gameplay.
No backend — runs entirely in the browser.

**Live:** https://morbeo.github.io/viktorani/
**API docs:** [![API Docs](https://img.shields.io/badge/docs-API-blue)](https://morbeo.github.io/viktorani/api/)

---

## Contents

- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Documentation](#documentation)
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
npm install
npm run dev
```

### Available scripts

| Script                  | What it does                                   |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Start dev server at `localhost:5173`           |
| `npm run build`         | Type-check + production build → `dist/`        |
| `npm run docs`          | Generate API docs → `docs/api/` (gitignored)   |
| `npm run lint`          | ESLint across all `*.ts` / `*.tsx` files       |
| `npm run typecheck`     | Type-check app and test files (both tsconfigs) |
| `npm run test`          | Run unit tests once via Vitest                 |
| `npm run test:watch`    | Run tests in watch mode                        |
| `npm run test:coverage` | Run tests with V8 coverage report              |
| `npm run test:e2e`      | Run Playwright e2e tests (requires built dist) |
| `npm run test:e2e:ui`   | Open Playwright UI mode                        |
| `npm run test:e2e:report` | Open last Playwright HTML report            |
| `npm run preview`       | Serve the production build locally             |
| `npm run pack`          | Build release tarball via `scripts/pack.sh`    |
| `npm run release:dry`   | Preview release — no changes made              |
| `npm run release`       | Interactive release: choose version, tag, push |
| `npm run release:patch` | Non-interactive patch bump                     |
| `npm run release:minor` | Non-interactive minor bump                     |

---

## Documentation

| Document | Description |
| -------- | ----------- |
| [Host guide](docs/user-guide/host.md) | Setting up and running a trivia night |
| [Player guide](docs/user-guide/player.md) | Joining a game and buzzing in |
| [API docs](https://morbeo.github.io/viktorani/api/) | Generated TypeDoc — transport, DB, hooks |
| [Architecture decisions](docs/adr/) | ADRs for all major technical decisions |

To generate API docs locally:

```bash
npm run docs
# Output: docs/api/ (gitignored — generated at build time)
```

---

## Project structure

```
src/
├── db/
│   ├── index.ts          # Dexie schema — all collections
│   └── snapshot.ts       # JSON export / import
├── transport/
│   ├── types.ts          # GameEvent / PlayerEvent interfaces
│   ├── PeerJSTransport.ts
│   ├── GunTransport.ts   # SEA-encrypted Gun.js relay
│   └── index.ts          # TransportManager — auto-detect + manual override
├── hooks/
│   ├── useTransport.ts
│   ├── useBuzzer.ts
│   ├── useGameVisibility.ts
│   ├── useScoreboard.ts
│   └── useTimer.ts
├── components/
│   ├── AdminLayout.tsx
│   ├── host/             # HostQuestionPanel and sub-components
│   ├── timer/            # TimerPanel, TimerCard, CreateTimerModal
│   └── ui/index.tsx      # Button, Card, Input, Modal, Badge…
├── pages/
│   ├── admin/            # Dashboard, Questions, Games, GameMaster, Layouts, Notes, Settings
│   └── player/           # Join, Play
├── test/
│   ├── setup.ts          # jsdom polyfills (fake-indexeddb, URL mocks)
│   ├── transport.test.ts
│   ├── db.test.ts
│   ├── db-migration.test.ts
│   ├── ui.test.tsx
│   ├── routing.test.tsx
│   ├── questions-search.test.ts
│   ├── settings.test.tsx
│   ├── host/             # HostQuestionPanel component tests
│   ├── buzzer.test.ts
│   └── timer/            # Timer hook and component tests
└── App.tsx               # HashRouter + all routes

docs/
├── adr/                  # Architecture Decision Records
└── user-guide/           # Host and player guides

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

**Collections:** difficulties, tags, questions, rounds, games, teams, players,
buzzEvents, layouts, widgets, notes, timers, gameQuestions.

**Backup:** export a full JSON snapshot from the Dashboard. Import it on any device to
restore or share your question bank.

---

## CI/CD

### Workflows

| Workflow        | Trigger                        | Purpose                                                                |
| --------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `ci.yml`        | PRs to `master`                | PR title lint + type-check, lint, test, build — both required to merge |
| `deploy.yml`    | push to `master` + manual      | Type-check → lint → test → build → deploy to GitHub Pages              |
| `docs.yml`      | push to `master` (src/ changes) | Generate TypeDoc → publish to `gh-pages` under `/api/`                |
| `release.yml`   | push of `v*` tags              | Build tarball → generate release notes → publish GitHub Release        |
| `automerge.yml` | `CI` workflow completes        | Auto-merge Dependabot patch/minor PRs when CI passes                   |

All workflows set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to opt into the Node 24 runner ahead of the June 2026 forced migration.

`deploy.yml` only triggers on pushes that touch `src/`, `public/`, `index.html`, `vite.config.ts`, or `package*.json`, and ignores tag pushes — preventing a collision with `release.yml` when `release-it` bumps the version.

### Branch protection

`master` requires two status checks before merge:

| Check             | What it gates                          |
| ----------------- | -------------------------------------- |
| `CI / lint-title` | PR title follows conventional commits  |
| `CI / ci`         | Type-check, lint, test, build all pass |

Force pushes and branch deletion are blocked. To apply or re-apply protection:

```bash
bash scripts/protect-master.sh
```

> **Note:** `scripts/` is gitignored. Add scripts explicitly with `git add --force scripts/`

### Dependabot

Dependencies are updated weekly (Monday 08:00 Sofia time). Patch and minor updates are grouped into a single PR per ecosystem and auto-merged once CI passes. Major bumps require manual review.

Labels used: `dependencies` (npm + Actions), `ci` (Actions only). Create them once:

```bash
gh label create dependencies --color 0075ca --description "Dependency updates"
gh label create ci --color e4e669 --description "CI/CD changes"
```

### Versioning & releasing

[Conventional commits](https://www.conventionalcommits.org/) drive automatic versioning via `release-it` + `git-cliff`:

| Commit prefix                 | Version bump    |
| ----------------------------- | --------------- |
| `feat:`                       | minor (`0.x.0`) |
| `fix:`, `perf:`               | patch (`0.0.x`) |
| `feat!:` / `BREAKING CHANGE:` | major (`x.0.0`) |

**To cut a release locally:**

```bash
npm run release:dry     # preview — no changes made
npm run release         # interactive: choose version, tag, push, publish
npm run release:patch   # non-interactive patch bump
npm run release:minor   # non-interactive minor bump
```

`release-it` will:

1. Run lint + tests
2. Bump the version in `package.json`
3. Build the release tarball via `scripts/pack.sh`
4. Commit, tag, and push
5. Update `CHANGELOG.md`

Pushing the tag triggers `release.yml`, which builds a fresh tarball, generates per-release notes with `git-cliff`, and publishes the GitHub Release. `GITHUB_TOKEN` is sufficient — no extra PAT required.

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

### Unit and integration tests (Vitest)

Tests are organised by feature area under `src/test/`. Run them with:

```bash
npm run test            # run once
npm run test:watch      # watch mode during development
npm run test:coverage   # coverage report → coverage/lcov.info
```

Tests run on every commit locally (pre-commit hook) and on every push to `master` (deploy workflow gate).

Two tsconfigs keep app and test types separate:

- `tsconfig.app.json` — excludes `src/test/`, no vitest globals
- `tsconfig.test.json` — includes only `src/test/`, adds `vitest/globals` and `@testing-library/jest-dom`

### End-to-end tests (Playwright)

E2E tests live in `e2e/` and run against the production build served by
`vite preview`. They require Playwright browsers to be installed once:

```bash
npx playwright install chromium --with-deps   # CI: chromium only
npx playwright install                         # local: all browsers
```

Then build and run:

```bash
npm run build
npm run test:e2e                  # headless, all configured projects
npm run test:e2e:ui               # interactive UI mode
npm run test:e2e:report           # open last HTML report
```

The CI workflow (`.github/workflows/e2e.yml`) triggers on every push and
PR to `master`, runs chromium only, and uploads the Playwright HTML report
as an artifact when any test fails.

**Coverage areas:**

| File | What it tests |
| ---- | ------------- |
| `e2e/smoke.spec.ts` | Page title present |
| `e2e/pwa.spec.ts` | Routes render, manifest valid, SW active, offline shell |
| `e2e/admin-players-teams.spec.ts` | Players, teams, labels CRUD, QR modals, bulk actions |
| `e2e/admin-questions-rounds.spec.ts` | Question CRUD persists, round builder add/remove |
| `e2e/gamemaster-session.spec.ts` | Full game session, two browser contexts |
| `e2e/transport-buzzer.spec.ts` | Buzzer lock/unlock across two real browser contexts |
| `e2e/screen-widget-layout.spec.ts` | Screen widgets render, layout switch, reload persistence |
| `e2e/db-persistence.spec.ts` | IDB records survive reload, verified via `page.evaluate()` |
| `e2e/ui-keyboard-aria.spec.ts` | axe audit, tab order, QR modal keyboard access |

> `npm run test:e2e` is intentionally separate from `npm run test` so
> Vitest and Playwright never run in the same command.

---

## Contributing

1. Fork → branch off `master`
2. Follow conventional commits (`feat(scope): description`)
3. Pre-commit hooks (husky) run lint-staged (ESLint + Prettier on staged files), typecheck, and the full test suite automatically
4. PR title must pass conventional commit lint (checked by `pr-title.yml`)
5. Open PR against `master`

### Commit types

`feat` · `fix` · `refactor` · `perf` · `test` · `docs` · `ci` · `chore` · `build` · `epic`

> `epic` is used as the type on PR-level commits that close a multi-subtask issue.

### Commit scopes

`admin` · `player` · `gamemaster` · `transport` · `db` · `ui` · `routing` · `pwa` · `build` · `deps` · `release` · `test` · `lint` · `github`
