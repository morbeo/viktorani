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

`buzzerEnabled` becomes a derived read (`inputType === 'buzzer'`) during a migration that sets
`inputType` from it, and is then removed. Nothing in the flow may depend on the buzzer: rulings,
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
- `perQuestion`: revealed when the host rules, or when the question locks.
- `endOfRound`: nothing is revealed during the round. At the round boundary the host opens a
  round review with two views:
  - **One by one**: step through the round's questions, revealing each answer (and, with
    `choice`/`text`, who got it) with **Reveal** / **Next**. Fits reading answers out.
  - **Table**: every question of the round with its correct answer, and in team or player
    columns each one's answer and mark. Fits the projector at the end of a written round.

A reveal sends a new host event, `REVEAL { gameQuestionId, answer, results? }`, to players
and screens, and switches the layout phase to `reveal`. `results` is a short list of
`{ playerId | teamId, correct }` and never includes other players' typed text on player
phones; the screen may show it in the table view. The answer is sent only in `REVEAL`, never in
`QUESTION_CONTENT`, so a player client can't read it early.

### 4. Delivery order

1. Host rulings with no buzz (done).
2. `revealTiming` with `manual` and `perQuestion`, and the `REVEAL` event.
3. `endOfRound` with the one-by-one and table views.
4. `inputType` with `choice`, the `answers` table and automatic judging.
5. `text` answers and host marking.

Each step ships on its own and leaves the game playable.

---

## Consequences

- A game runs without the buzzer from start to finish, and the buzzer becomes a setting like any
  other.
- `REVEAL` is the only message that carries a correct answer. The rule "players are never sent
  the correct answer" becomes "only after the host, or the game's reveal setting, reveals it".
- `ANSWER` is new untrusted input from players: it is validated by zod, limited in size and
  accepted only for the current, unlocked question from a connected player of that game.
- The `answers` table grows with players × questions and is cleared with the game, like buzzes.
- Game snapshots (`snapshot-schema.ts`) need `inputType`, `revealTiming` and the answers table.

## Alternatives considered

- **Keep the buzzer as the core and add answers on top of buzzes.** Rejected: a written round
  has no buzz order, and every non-buzzer feature would have to fake a buzz.
- **Reveal as part of ruling.** Rejected: end-of-round reveal is the common pub-quiz flow, and
  a ruling that reveals would give answers away mid-round.
- **Send the answer with the question and hide it on the client.** Rejected: any player could
  read it from the transport.
