# Architecture

Viktorani is a serverless trivia PWA. The host's browser is the whole backend: it stores
everything in IndexedDB and talks to player phones directly over WebRTC. This guide shows how
the code is organised and how data moves through it. The reasons behind each choice are in the
[ADRs](adr/).

## Contents

- [The big picture](#the-big-picture)
- [Layers](#layers)
- [Source tree](#source-tree)
- [Why there is no class hierarchy](#why-there-is-no-class-hierarchy)
- [Data model](#data-model)
- [Transport](#transport)
- [Game lifecycle](#game-lifecycle)
- [Game master page](#game-master-page)
- [Backups and import](#backups-and-import)
- [Testing](#testing)
- [Known rough edges](#known-rough-edges)

## The big picture

```mermaid
flowchart LR
  subgraph Host["Host browser (GM)"]
    UI[Admin pages] --> DB[(IndexedDB<br/>Dexie)]
    UI --> TM[TransportManager]
  end
  subgraph Phones["Player phones"]
    P1[Join / Play pages] --> TP[TransportManager]
  end
  Broker[[PeerJS cloud broker<br/>signalling only]]
  TM <-. WebRTC data channels .-> TP
  TM -. find peers .- Broker
  TP -. find peers .- Broker
```

- **No server.** The app is static files on GitHub Pages ([ADR 0001](adr/0001-pwa-no-backend.md)).
- **The host is the source of truth.** Only the GM's browser writes to the database. Players get
  state through transport messages ([ADR 0002](adr/0002-indexeddb-dexie.md)).
- **PeerJS is the only transport.** The public PeerJS broker only introduces peers; game data
  flows directly between browsers ([ADR 0015](adr/0015-peerjs-only-transport.md)).
- **Offline first.** A service worker caches the app shell ([ADR 0010](adr/0010-pwa-offline-first.md)).

## Layers

Each layer only imports from the layers below it.

```mermaid
flowchart TD
  App["App.tsx<br/>HashRouter + ToastProvider"] --> Pages
  Pages["pages/<br/>one component per route"] --> Components
  Pages --> Hooks
  Components["components/<br/>feature UI + ui/ primitives"] --> Hooks
  Hooks["hooks/<br/>stateful logic"] --> DB
  Hooks --> Transport
  Components --> DB
  Pages --> DB
  Pages --> Transport
  DB["db/<br/>Dexie schema, CRUD, snapshots"]
  Transport["transport/<br/>PeerJS, message contract"]
```

| Layer         | Responsibility                                                                  |
| ------------- | ------------------------------------------------------------------------------- |
| `pages/`      | Route components. Load data, own page state, compose components.                 |
| `components/` | Feature UI grouped by area (`buzzer/`, `gamemaster/`, `timer/`, …) and `ui/`.    |
| `hooks/`      | Reusable stateful logic: buzzer, timers, navigation, scoreboard, lifecycle.      |
| `db/`         | Dexie database, typed tables, multi-table helpers, backup import/export.         |
| `transport/`  | Real-time messaging between host and players, and the zod message contract.      |
| `types/`      | Shared types that don't belong to a single table (managed players and teams).   |

Reads use `useLiveQuery` (dexie-react-hooks) or a one-off `db.table.get()`. Writes go straight
to `db`, then the writer sends the matching transport event so players stay in sync.

### Routes

The app uses `HashRouter` so it works on GitHub Pages without server rewrites
([ADR 0004](adr/0004-hash-router.md)).

| Route                                   | Page           | Who     |
| --------------------------------------- | -------------- | ------- |
| `/admin`                                | Dashboard      | Host    |
| `/admin/questions`                      | Questions      | Host    |
| `/admin/games`                          | Games (wizard) | Host    |
| `/admin/game/:id`                       | GameMaster     | Host    |
| `/admin/players-teams`                  | PlayersTeams   | Host    |
| `/admin/notes`, `/admin/notes/:id`      | Notes          | Host    |
| `/admin/settings`                       | Settings       | Host    |
| `/admin/layouts/:gameId`                | Layouts (stub) | Host    |
| `/join`, `/join/:roomId`                | Join           | Players |
| `/play/:roomId`                         | Play           | Players |

## Source tree

```text
src/
├── App.tsx, main.tsx        routing, theme, providers
├── pages/
│   ├── admin/               host pages + GameMaster helpers
│   │                        (gamemaster-utils.ts, player-connections.ts)
│   └── player/              Join, Play
├── components/
│   ├── ui/                  Button, Input, Modal, Toast, Icon, control size…
│   ├── gamemaster/          GameControls, RosterPanel, TeamManagerPanel, JoinPolicyPanel
│   ├── host/                HostQuestionPanel and its parts, visibility toggles
│   ├── buzzer/              BuzzerPanel, BuzzList, BuzzerLockButton
│   ├── timer/               TimerPanel, TimerCard, modals, expiry overlay
│   ├── scoreboard/          ScoreboardPanel
│   ├── players-teams/       managed roster: lists, forms, QR, labels
│   └── settings/            difficulties, tags, debug panel
├── hooks/                   useBuzzer, useTimer, useNavigation, useScoreboard, …
├── db/                      index.ts (schema), games.ts, players-teams.ts,
│                            snapshot.ts + snapshot-schema.ts, demo.ts
├── transport/               types.ts, messages.ts, PeerJSTransport.ts, index.ts
└── test/                    Vitest suites (mirrors the tree loosely)
```

## Why there is no class hierarchy

This is a React function-component codebase, so structure comes from **composition**, not
inheritance. Behaviour is shared through hooks and small components, and data shapes are plain
TypeScript interfaces. There are only three classes, each wrapping an external library:

```mermaid
classDiagram
  class Dexie
  class ViktoraniDB {
    +games Table~Game~
    +players Table~Player~
    +teams Table~Team~
    +questions Table~Question~
    +12 more tables
  }
  Dexie <|-- ViktoraniDB

  class ITransport {
    <<interface>>
    +connect(config)
    +disconnect()
    +send(event)
    +sendTo(connId, event)
    +onEvent(handler)
    +onPeerClose(handler)
  }
  class PeerJSTransport
  ITransport <|.. PeerJSTransport

  class TransportManager {
    -transport ITransport
    +connect(config)
    +send(event)
    +sendTo(connId, event)
    +onEvent(handler)
    +onPeerClose(handler)
  }
  TransportManager o-- ITransport : wraps
```

- **`ViktoraniDB extends Dexie`** declares the schema and versions. The singleton is `db`.
- **`PeerJSTransport implements ITransport`** is the only transport. The interface stays so
  tests can use a fake and a future transport can be added without touching callers.
- **`TransportManager`** (singleton `transportManager`) loads PeerJS lazily, validates every
  incoming message and fans events out to subscribers.

The equivalent of "inheritance" elsewhere is:

| Need                     | Pattern used                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| Share stateful behaviour | A custom hook (`useBuzzer`, `useTimer`, `useGameLifecycle`)        |
| Share UI                 | A component with props (`Button`, `Modal`, `HostQuestionPanel`)    |
| Share cross-cutting data | React context (`ToastProvider`, `ControlSizeContext`)             |
| Vary by kind             | Discriminated unions (`TransportEvent`, `Question.type`)           |
| Share pure logic         | Plain functions (`gamemaster-utils.ts`, `db/games.ts`)             |

## Data model

All tables live in one Dexie database, `viktorani`. IDs are UUID strings. Only indexed fields
can be used in `where()`.

```mermaid
erDiagram
  Question }o--o| DifficultyLevel : "difficulty"
  Question }o--o{ Tag : "tags[]"
  Round ||--o{ Question : "questionIds[] (ordered)"
  Game ||--o{ Round : "roundIds[] (ordered)"
  Game ||--o{ GameQuestion : "per-game question status"
  GameQuestion }o--|| Question : "questionId"
  Game ||--o{ Team : "gameId"
  Game ||--o{ Player : "gameId"
  Player }o--o| Team : "teamId"
  Game ||--o{ BuzzEvent : "gameId"
  BuzzEvent }o--|| Player : "playerId"
  Game ||--o{ Timer : "gameId"
  Game ||--o{ Layout : "gameId"
  Layout ||--o{ Widget : "layoutId"
  ManagedPlayer }o--o{ ManagedTeam : "teamIds[] / playerIds[]"
  ManagedPlayer }o--o{ ManagedLabel : "labelIds[]"
  ManagedTeam }o--o{ ManagedLabel : "labelIds[]"
```

- **Question bank:** `questions`, `difficulties`, `tags`, `rounds`. Tags replaced categories
  ([ADR 0011](adr/0011-tag-only-classification.md)).
- **A game:** `games` plus its per-game rows: `gameQuestions`, `teams`, `players`,
  `buzzEvents`, `timers`. Deleting a game removes them all (`db/games.ts`).
- **Managed roster:** `managedPlayers`, `managedTeams`, `managedLabels` are reusable across
  games. A game's `teams`/`players` can be imported from them. The two-way
  `teamIds`/`playerIds` link is kept in sync by `db/players-teams.ts`.
- **Scores:** each `Player.score` and `Team.score` is stored separately; a team's score is not
  the sum of its members.
- **Notes** and **layouts** are standalone (layouts are a stub for now).

### Schema versions

Dexie version numbers only go up ([ADR 0009](adr/0009-dexie-versioned-migrations.md)). To change
the schema, add a `this.version(N + 1)` block under the existing ones in `db/index.ts`, with an
`.upgrade()` to back-fill data if needed. Version 6, for example, back-fills the join policy
fields on existing games.

## Transport

### Connecting

```mermaid
sequenceDiagram
  participant GM as Host (GameMaster)
  participant B as PeerJS broker
  participant P as Player (Join/Play)
  GM->>B: register peer id "vkt-" + roomId
  P->>B: open a connection to "vkt-" + roomId
  B-->>P: WebRTC signalling
  P->>GM: data channel open (connection id)
  P->>GM: JOIN {playerName, deviceId, teamId, newTeamName}
  GM->>GM: resolveJoin(): match deviceId or create Player
  GM->>GM: bind connection id to player
  GM-->>P: JOIN_ACCEPTED {playerId, teamId}
  GM-->>P: GAME_STATE {…}
  loop during the game
    GM-->>P: BUZZER_UNLOCK, VISIBILITY, TIMER_*, SCORE_UPDATE…
    P->>GM: BUZZ {timestamp}
    GM->>GM: look up player by connection, record BuzzEvent
  end
  P--xGM: connection closes
  GM->>GM: mark player away
```

- **Room code** is the only access control. The host's PeerJS id is `vkt-<roomId>`.
- **Identity comes from the connection, not the message.** Player messages carry no `playerId`.
  The host binds each connection to a player on `JOIN` (`PlayerConnections` in
  `pages/admin/player-connections.ts`) and ignores events from unbound connections.
- **Every incoming message is validated.** `transport/messages.ts` holds strict zod schemas with
  size limits; `TransportManager` drops anything that fails `parseTransportEvent()`.
- **`send()`** broadcasts to every player; **`sendTo(connId)`** replies to one.

### Messages

```mermaid
flowchart LR
  subgraph GameEvent["Host → players (GameEvent)"]
    direction TB
    g1[GAME_STATE / GAME_STATUS]
    g2[LOBBY_INFO / JOIN_PENDING<br/>JOIN_ACCEPTED / JOIN_REJECTED]
    g3[BUZZER_LOCK / BUZZER_UNLOCK]
    g4[VISIBILITY / QUESTION_CONTENT]
    g5[SLIDE_CHANGE / SCORE_UPDATE]
    g6[TIMER_START / PAUSE / RESUME<br/>RESET / EXPIRED]
  end
  subgraph PlayerEvent["Players → host (PlayerEvent)"]
    direction TB
    p1[JOIN / LEAVE]
    p2[BUZZ]
    p3[FOCUS_CHANGE]
  end
```

Types are in `transport/types.ts`; schemas and limits are in `transport/messages.ts`. When you
add a message, add both, and a test in `src/test/transport-messages.test.ts`.

The player side (Join and Play connecting and sending events) is being built in Epic #244.

## Game lifecycle

```mermaid
stateDiagram-v2
  [*] --> waiting: Games wizard creates game
  waiting --> active: GM clicks Start (lobby)
  active --> paused: Pause
  paused --> active: Resume
  active --> ended: End game
  paused --> ended: End game
  ended --> [*]
```

Each transition is written to `games.status` and broadcast as `GAME_STATUS`
(`hooks/useGameLifecycle.ts`). An ended game is read-only. Players and screens follow it:
while paused the buzz button is held, and once ended they keep the final score up instead of
reporting a lost connection.

## Game master page

`pages/admin/GameMaster.tsx` is the busiest part of the app. It renders the **Lobby** while the
game is `waiting` and the **ActiveGame** view otherwise.

```mermaid
flowchart TD
  GM[GameMaster<br/>loads game, players, teams<br/>connects transport, handles player events]
  GM --> Lobby
  GM --> Active[ActiveGame]
  Lobby --> QR[Join QR + room code]
  Lobby --> Roster[RosterPanel]
  Lobby --> Teams[TeamManagerPanel]
  Lobby --> Join1[JoinPolicyPanel]
  Active --> Controls[GameControls<br/>pause, end, control size]
  Active --> Nav[NavHeader<br/>useNavigation, useKeyNav]
  Active --> Q[HostQuestionPanel<br/>useGameVisibility]
  Active --> Buzz[BuzzerPanel<br/>useBuzzer]
  Active --> Timers[TimerPanel<br/>useTimerList]
  Active --> Join2[JoinPolicyPanel]
  Active --> Score[ScoreboardPanel<br/>useScoreboard]
```

- Child panels get the `game` and an `onGameChange(patch)` callback. They write the change to
  the database themselves and pass back only the changed fields; `GameMaster` merges them.
- Player events (`JOIN`, `BUZZ`, `LEAVE`, `FOCUS_CHANGE`) are handled in `GameMaster` and
  forwarded to hooks (for example, buzzes go to `useBuzzer` through `buzzHandlerRef`).
- Control size (S / M / L) is a `ControlSizeContext` provided by `GameMaster` and read by
  `Button` and the larger custom controls.

## Backups and import

```mermaid
flowchart LR
  DB[(IndexedDB)] -- exportDatabase --> JSON[viktorani-backup-DATE.json]
  JSON -- importDatabase --> Z{zod snapshot schema}
  Z -- valid --> TX[one Dexie transaction<br/>upserts by id]
  Z -- invalid --> Err[error, nothing written]
```

A backup holds the question bank (questions, rounds, difficulties, tags), game definitions with
the questions each game plays (`gameQuestions`) and notes; live per-game rows such as players and
buzzes are not included. Import upserts rows by id,
so existing data with other ids is kept, and a failed write rolls back the whole import.
`db/snapshot-schema.ts` accepts older backup versions and fills in defaults for fields added
later, so old backups keep working. Question-only import/export and note files use the same
module. `db/demo.ts` seeds a demo game from the Settings debug panel.

## Testing

- **Vitest** with jsdom and `fake-indexeddb`; each suite starts with `// @vitest-pool vmForks`
  ([ADR 0012](adr/0012-vitest-vmforks-pool.md)). Tests live in `src/test/`.
- `game-flow.test.tsx` renders the real host and player screens, linked by an in-memory
  transport, and plays one buzz from join to score.
- CI runs typecheck, lint, tests with coverage, build and a bundle size check on every PR.

## Known rough edges

- `GameMaster.tsx`, `Games.tsx` and `Questions.tsx` are 750–1150 lines each. Splitting their
  inner components into `components/` would make them easier to follow.
- `gamemaster-utils.ts` and `player-connections.ts` hold domain logic but live under `pages/`.
- Some small UI pieces are duplicated (for example, local `Toggle` switches in the Games wizard,
  the visibility toggles and the join policy panel).
- The player pages are not connected to the host yet (Epic #244).
