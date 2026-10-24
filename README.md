# Viktorani

Bar trivia PWA with WebRTC multiplayer and buzzer gameplay.
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

| Layer       | Library                      |
| ----------- | ---------------------------- |
| UI          | React 19 + TypeScript        |
| Styling     | Tailwind CSS v4              |
| Build       | Vite 8                       |
| PWA         | vite-plugin-pwa              |
| Storage     | Dexie.js (IndexedDB)         |
| Multiplayer | PeerJS (WebRTC)              |
| Routing     | React Router v7 (HashRouter) |
| Validation  | Zod                          |

---

## Getting started

```bash
git clone https://github.com/morbeo/viktorani.git
cd viktorani
npm install
npm run dev
```

To try it with sample data, run `npm run demo` instead. It opens the admin panel with demo questions, rounds, teams, and a ready-to-run game named **Demo Night**. Running it again won't create duplicates. In a running app, use **Load demo data** in Settings → Data or the command palette (Ctrl/⌘+K).

### Available scripts

| Script                  | What it does                                   |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Start dev server at `localhost:5173`           |
| `npm run demo`          | Dev server + seed demo data, opens admin panel |
| `npm run build`         | Type-check + production build → `dist/`        |
| `npm run docs`          | Generate API docs → `docs/api/` (gitignored)   |
| `npm run check:size`    | Check built bundle sizes against limits        |
| `npm run lint`          | ESLint across all `*.ts` / `*.tsx` files       |
| `npm run typecheck`     | Type-check app and test files (both tsconfigs) |
| `npm run test`          | Run unit tests once via Vitest                 |
| `npm run test:watch`    | Run tests in watch mode                        |
| `npm run test:coverage` | Run tests with V8 coverage report              |
| `npm run preview`       | Serve the production build locally             |
| `npm run pack`          | Build release tarball via `scripts/pack.sh`    |

---

## Documentation

| Document                                            | Description                                                 |
| --------------------------------------------------- | ----------------------------------------------------------- |
| [Host guide](docs/user-guide/host.md)               | Setting up and running a trivia night                       |
| [Player guide](docs/user-guide/player.md)           | Joining a game and buzzing in                               |
| [API docs](https://morbeo.github.io/viktorani/api/) | Generated TypeDoc — transport, DB, hooks, settings, layouts |
| [Architecture guide](docs/ARCHITECTURE.md)          | Layers, data model, transport, diagrams                     |
| [Architecture decisions](docs/adr/)                 | ADRs for all major technical decisions                      |

To generate API docs locally:

```bash
npm run docs
# Output: docs/api/ (gitignored)
```

TypeDoc treats warnings as errors, so a broken `{@link}` fails `npm run docs`. CI runs it on every
PR, and `deploy.yml` publishes the output to `/viktorani/api/` alongside the app.

---

## Project structure

```
src/
├── App.tsx, main.tsx     # HashRouter, routes, providers
├── pages/
│   ├── admin/            # Dashboard, Questions, Games, GameMaster, Layouts, Notes, Players & Teams, Settings
│   ├── player/           # Join, Play
│   └── screen/           # Remote display screens
├── components/           # Feature UI (gamemaster, host, buzzer, timer, layout-designer, ...) + ui/ primitives
├── widgets/              # Layout widget registry, built-in layouts, LayoutRenderer
├── hooks/                # useTransport, useBuzzer, useTimer, useScoreboard, useGameLifecycle, ...
├── lib/                  # App settings store, layout helpers, formatting, rate limiting
├── db/                   # Dexie schema (index.ts), game/roster helpers, snapshot export/import, demo data
├── transport/            # PeerJS transport, TransportManager, message types and Zod schemas
├── types/                # Shared types (managed players and teams)
└── test/                 # Vitest suites

docs/
├── ARCHITECTURE.md       # Layers, data model, transport, diagrams
├── adr/                  # Architecture Decision Records
└── user-guide/           # Host and player guides
```

The [architecture guide](docs/ARCHITECTURE.md#source-tree) has a more detailed tree.

---

## Multiplayer

No backend server. The host generates a **Room ID** which is embedded in a QR code
that players scan. After the initial WebRTC handshake via PeerJS signaling,
all game state flows browser-to-browser with no server involvement.

---

## Data storage

All data lives in **IndexedDB** (via Dexie.js) on the host device. Nothing is sent to
any server.

**Collections:** difficulties, tags, questions, rounds, games, teams, players,
buzzEvents, scoreEvents, gameLog, layouts, widgets, notes, timers, gameQuestions,
managedPlayers, managedTeams, managedLabels.

**Backup:** export a JSON snapshot from **Settings → Data → Export JSON**. Import it on
any device to restore or share your question bank. It holds difficulties, tags,
questions, rounds, games, gameQuestions, notes, layouts, widgets and app settings. Live-game data (teams,
players, buzzEvents, scoreEvents, gameLog, timers) and the managed players, teams and labels
are not included. **Import JSON** adds and updates rows; **Replace from JSON** also removes
anything the file doesn't have, after showing what will go.

---

## CI/CD

### Workflows

| Workflow                   | Trigger                      | Purpose                                                              |
| -------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `ci.yml`                   | PRs to `master`              | PR title lint + type-check, lint, test, build, bundle size, API docs |
| `deploy.yml`               | push to `master` + manual    | Build the app and TypeDoc API docs → deploy to GitHub Pages          |
| `release.yml`              | manual (`workflow_dispatch`) | Bump version, update changelog, tag, publish GitHub Release, deploy  |
| `dependabot-automerge.yml` | `CI` workflow completes      | Auto-merge Dependabot patch/minor PRs when CI passes                 |

All workflows set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to opt into the Node 24 runner.

`deploy.yml` only triggers on pushes that touch `src/`, `public/`, `index.html`, `vite.config.ts`,
`typedoc.json`, or `package*.json`, and ignores tag pushes and `chore(release):` commits;
`release.yml` triggers the deploy itself after tagging.

`ci.yml` skips the build job when a PR changes no code (docs-only PRs), per
`scripts/detect-code-changes.sh`.

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

### Dependabot

Dependencies are updated weekly (Monday 08:00 Sofia time). Patch and minor updates are grouped into a single PR per ecosystem and auto-merged once CI passes. Major bumps require manual review.

Labels used: `dependencies` (npm + Actions), `ci` (Actions only). Create them once:

```bash
gh label create dependencies --color 0075ca --description "Dependency updates"
gh label create ci --color e4e669 --description "CI/CD changes"
```

### Versioning & releasing

Releases are cut from GitHub Actions: run the **Release** workflow and pick the bump
(`patch`, `minor` or `major`), optionally marking it a pre-release.

```bash
gh workflow run release.yml -f bump=patch
```

The workflow will:

1. Run lint, typecheck and tests
2. Bump the version in `package.json`
3. Regenerate `CHANGELOG.md` with `git-cliff` from the conventional commits
4. Commit `chore(release): vX.Y.Z`, tag, and push to `master` (uses the `RELEASE_PAT` secret to
   bypass branch protection)
5. Publish a GitHub Release with the notes for that version
6. Trigger `deploy.yml` (unless `deploy` is set to `false`)

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

Tests run locally on every commit that stages code (pre-commit hook), in CI on every PR, and in the
release workflow before tagging.

Two tsconfigs keep app and test types separate:

- `tsconfig.app.json` — excludes `src/test/`, no vitest globals
- `tsconfig.test.json` — includes only `src/test/`, adds `vitest/globals` and `@testing-library/jest-dom`

---

## Contributing

1. Fork → branch off `master`
2. Follow conventional commits (`feat(scope): description`)
3. Pre-commit hooks (husky) run lint-staged (ESLint + Prettier on staged files), typecheck, and the full test suite automatically
4. PR title must pass conventional commit lint (the `lint-title` job in `ci.yml`)
5. Open PR against `master`

### Commit types

`feat` · `fix` · `chore` · `refactor` · `perf` · `test` · `build` · `revert` · `epic`

Documentation-only changes use `chore(docs): …`.

> `epic` is used as the type on PR-level commits that close a multi-subtask issue.

### Commit scopes

`admin` · `player` · `gamemaster` · `transport` · `db` · `ui` · `routing` · `pwa` · `build` · `deps` · `docs` · `release` · `test` · `lint` · `github`
