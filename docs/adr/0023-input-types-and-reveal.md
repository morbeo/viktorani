# ADR 0023 — Answer input types and reveal timing

**Date:** 2026-10-19
**Status:** Proposed
**Deciders:** Vladimir Kirov

---

## Context

The game flow grew around the buzzer: a player buzzes, the host rules on the buzz, points go
to that player. Many quiz formats don't work that way. In a pub quiz every team writes an
answer to every question, and the answers are read out at the end of the round. In a
classroom quiz everyone picks an option on their phone.

What exists today:

| Piece          | Today                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Buzzer         | `Game.buzzerEnabled`, `BUZZ` from players, `useBuzzer` ordering and rulings per buzz.                                                       |
| Host rulings   | Correct / Wrong / Skip on the question panel with optional points to a player or team (`ruleQuestion`), no buzz needed.                     |
| Question state | `GameQuestion.status` is `pending`, `correct`, `incorrect` or `skipped`: one ruling per question, not per player.                           |
| Answer privacy | `QUESTION_CONTENT.answer` is always `null` for players and screens. `showAnswers` means the options of a multiple-choice or true/false one. |
| Phases         | `reveal` exists as a layout phase (ADR 0019), but nothing sends the correct answer.                                                         |

Two gaps follow: players can't send an answer other than a buzz, and the correct answer
can't be shown to players at all, either right away or later.

---

## Decision

### 1. The buzzer is one input type among several

A game picks how players answer with `Game.inputType`:

| `inputType` | Player sends                                         | Fits                            |
| ----------- | ---------------------------------------------------- | ------------------------------- |
| `none`      | Nothing. The host rules out loud (today's rulings).  | Hosted aloud, paper answers     |
| `buzzer`    | `BUZZ`, as today.                                    | Fastest finger                  |
| `choice`    | `ANSWER { questionId, choice: index }`               | Multiple choice and true/false  |
| `text`      | `ANSWER { questionId, text }`, trimmed, 1 to 200 ch. | Open-ended, written pub quizzes |

`inputType` replaces `buzzerEnabled`: a migration sets it from the old flag (`buzzer`, or
`none` with the buzzer off) and removes the flag. Nothing in the flow may depend on the buzzer: rulings,
scoring, auto-advance and the log work the same for every input type.

A question of the wrong shape for the input type (an open-ended question in a `choice` game)
falls back to `none` for that question, and the host panel says so.

### 2. Answers are stored per player, and judged per answer

A new `answers` table holds one row per player (or team, in a team game) per question:
`{ id, gameId, gameQuestionId, playerId, teamId, choice | text, receivedAt, ruling }`, where
`ruling` is `pending`, `correct` or `incorrect`. The host accepts one answer per player per
question; a later one replaces it until the question is locked (moving on locks it).

`choice` answers are judged automatically against `Question.answer`. `text` answers start
`pending`; the host marks each one, with a one-click "mark all matching" for exact matches
ignoring case and spacing. Points come from the answer's ruling, through the same
`writeScore` path rulings use, so a question can have several correct players.

`GameQuestion.status` stays as the summary the navigation and auto-advance read: `correct`
when any answer (or the host ruling) is correct, `incorrect` when all were judged wrong.

### 3. Reveal timing is a game setting, separate from ruling

Ruling never reveals anything to players. Revealing the correct answer is its own step, set by
`Game.revealTiming`:

- `manual`: the host clicks **Reveal answer** on the question. This is the default.
- `perQuestion`: revealed when the host rules on the question (Correct, Wrong or Skip on the
  question panel, or a correct buzz).
- `endOfRound`: nothing is revealed during the round. At the round boundary the host opens a
  round review with two views:
  - **One by one**: step through the round's questions, revealing each answer (and, with
    `choice`/`text`, who got it) with **Reveal** / **Next**. Fits reading answers out.
  - **Table**: every question of the round with its correct answer, and in team or player
    columns each one's answer and mark. Fits the projector at the end of a written round.

Revealing the question shown sets `GameQuestion.revealed`, and from then on the host's
`QUESTION_CONTENT` for that question carries the answer in `answer` (it is `null` until then,
whatever the visibility flags say). The layout phase switches to `reveal`. Keeping the answer
in the one message that already describes the question means a rejoining player or screen,
which is sent the current `QUESTION_CONTENT`, sees the answer exactly when it has been revealed.

The end-of-round review shows questions that are no longer current, so it adds a host event,
`ROUND_ANSWERS { target, review }`. `review` is `null` when the review is closed, or
`{ roundName, view, items }` with one item per revealed question of the round:
`{ questionId, number, title, answer, status }`. Only revealed questions are listed, the title
follows the target's visibility flags, and the host sends the current one to a rejoining
player or screen. Per-player results (`{ playerId | teamId, correct }`, never other players'
typed text on phones) join the items with step 4.

### 4. Security rules for answers and reveals

Player answers are untrusted input, and the correct answer is a secret until revealed:

- **Who answered comes from the host.** The host sets `playerId`, `teamId` and `receivedAt`
  from its own connection-to-player mapping and clock, never from the payload. The host's
  clock decides whether an answer arrived before the question locked.
- **`ANSWER` is checked against the game.** The host accepts it only for the current
  `gameQuestionId` of the same game. `choice` is checked against the question's options, and
  `text` is trimmed and limited in the zod schema. Replacing an answer is rate-limited per
  connection.
- **Team answers belong to the team.** In a team game any member may submit the team's
  answer, and the latest one replaces it until the question locks. The host shows who sent it.
- **Typed answers are plain text.** They render as React text on the host and screens, never
  as markdown or HTML. `ROUND_ANSWERS` has size limits on its items and strings in the schema.
- **The answer can't leak early.** `buildQuestionContent`, the only builder of
  `QUESTION_CONTENT`, fills `answer` only for a revealed question, and tests pin that. A
  rejoining player gets an answer (in `QUESTION_CONTENT` or `ROUND_ANSWERS`) only for questions
  already revealed.
- **Answers are not imported.** Snapshots leave out play data (players, buzzes, answers), so
  an imported file can't plant answers. If that changes, import validates them with zod, limits
  their number and size, and remaps their ids to the imported game, as for the other tables.

### 5. Delivery order

1. Host rulings with no buzz (done).
2. `revealTiming` with `manual` and `perQuestion`, the answer in `QUESTION_CONTENT` (done).
3. `endOfRound` with the one-by-one and table views, and the `ROUND_ANSWERS` event (done).
4. `inputType` with `choice`, the `answers` table and automatic judging (done).
5. `text` answers and host marking.

Each step ships on its own and leaves the game playable.

---

## Consequences

- A game runs without the buzzer from start to finish, and the buzzer becomes a setting like any
  other.
- A correct answer travels only in `QUESTION_CONTENT` for a revealed question and in `ROUND_ANSWERS`.
  The rule "players are never sent the correct answer" becomes "only after the host, or the
  game's reveal setting, reveals it".
- `ANSWER` is new untrusted input from players: it is validated by zod, limited in size and
  accepted only for the current, unlocked question from a connected player of that game.
- The `answers` table grows with players × questions and is cleared with the game, like buzzes.
- Game snapshots (`snapshot-schema.ts`) carry `inputType` and `revealTiming`. Answers are play
  data, like buzzes and players, so snapshots leave them out.

## Alternatives considered

- **Keep the buzzer as the core and add answers on top of buzzes.** Rejected: a written round
  has no buzz order, and every non-buzzer feature would have to fake a buzz.
- **Reveal as part of ruling.** Rejected: end-of-round reveal is the common pub-quiz flow, and
  a ruling that reveals would give answers away mid-round.
- **Send the answer with the question and hide it on the client.** Rejected: any player could
  read it from the transport.
