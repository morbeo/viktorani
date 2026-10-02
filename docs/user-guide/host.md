# Host Guide

Everything you need to run a trivia night with Viktorani.

---

## Contents

1. [Creating a question bank](#1-creating-a-question-bank)
2. [Building a game](#2-building-a-game)
3. [Running a game](#3-running-a-game)
4. [During a round](#4-during-a-round)
5. [Timer usage](#5-timer-usage)
6. [Ending the game](#6-ending-the-game)

---

## 1. Creating a question bank

### Difficulties

Go to **Settings → Library → Difficulty levels** to define point values for your game.
The defaults are Easy (5 pts), Medium (10 pts), and Hard (15 pts).
You can rename them, change their colours, and adjust their scores.

### Tags

Go to **Settings → Library → Tags** to create classifiers for your questions.
Tags are used for filtering — you can include or exclude by tag when browsing questions.
Example tags: `History`, `Pop Culture`, `Music`, `Local`.

### Adding questions

Go to **Questions → Add Question**. Fill in:

| Field | Required | Notes |
|---|---|---|
| Title | ✓ | The question text shown to players |
| Type | ✓ | See question types below |
| Answer | ✓ | Correct answer (not shown to players automatically) |
| Difficulty | — | Determines point value on correct buzz |
| Tags | — | Multi-select; used for filtering |
| Description | — | Markdown body (flavour text, citations) |
| Media | — | Upload an image, audio, or video file |

#### Question types

**Multiple choice** — Provide exactly 4 options; mark one as the correct answer.

```
Title:   Which planet has the most moons?
Options: Jupiter / Saturn / Uranus / Neptune
Answer:  Saturn
```

**True / False** — Options are fixed as `True` and `False`; mark the correct one.

```
Title:  The Great Wall of China is visible from space.
Answer: False
```

**Open-ended** — No options shown; the GM reads the answer and rules manually.

```
Title:  Who wrote Hamlet?
Answer: Shakespeare
```

### Bulk import

You can import many questions at once via **Questions → Import**.
Download the example file first to see the expected JSON structure.
Required fields per row: `title`, `type`, `answer`.

---

## 2. Building a game

Go to **Games → Create Game**.

### Add rounds

A game contains one or more rounds. Each round is an ordered list of questions.

1. Click **Add Round** to create a round.
2. Click the round to open it.
3. Click **Add Questions** to search and select questions from your bank.
4. Drag rows to reorder questions within a round.

You can also build rounds in step 2 of the **New game** wizard: choose **Create new rounds**,
then **Add round**. Name each round, open its question count to search or filter by tag and
tick questions, and use the arrows to reorder rounds. Every round needs a name and at least one
question. The rounds are saved with the game and show up on the Questions page afterwards.

### Configure the game

The first step of the **New game** wizard holds the game settings.

- **Preset** sets joining and the buzzer for a common kind of game:
  - **Open lobby**: anyone joins at any time, alone or in a team.
  - **Pub quiz**: teams only, up to 6 per team; the buzzer locks after a correct answer.
  - **Classroom**: you approve each player and make the teams; false starts are recorded.

  Change any setting afterwards and the preset shows as **Custom**.
- **Scoring**: keep a score for each player and team. It can't be changed once the game exists.
- **Visibility**: what player phones and the screen show (question text, answers, media).
- **Advanced** (collapsed): the individual joining and buzzer settings.

| Option | What it does |
|---|---|
| Individual play | Players may join without a team |
| Players may create teams | Players may type a new team name when they join |
| Allow late join / rejoin | Who may join after the start, and whether a dropped player comes back as themselves |
| Require approval | New players wait in Join requests until you approve them |
| Max teams / Max per team | Team limits; **No limit** (∞) by default |
| Auto-lock after a correct answer | Lock the buzzer after the first correct ruling |
| Record false starts | Keep buzzes that arrive while the buzzer is locked |
| Buzz display | `First per player` or `All attempts` |

During the game, **Game settings** in the header opens a drawer to change the joining and buzzer
settings live. Visibility is changed on the question panel.

---

## 3. Running a game

Open a game and click **Start Game** to enter the GameMaster (GM) view.

### Sharing the room

When the game starts, a room code and QR code are generated.

```
Room: XK7RQZ
```

Players can join by:
- Scanning the QR code with their phone camera.
- Visiting the Viktorani URL and entering the room code manually.

The QR code links directly to the join page with the room code pre-filled.

### Lobby

The GM sees a list of players in real time. Each player appears as they join, with an icon
showing where they stand (hover it for a description):

| Icon | State | Meaning |
|---|---|---|
| Green dot | Connected | Playing |
| Gold crossed-out eye | Tab hidden | Connected, but looking at something else |
| Grey crossed-out Wi-Fi | Disconnected | The connection dropped, or they haven't joined from a device; they can rejoin if rejoining is allowed |
| Grey exit arrow | Left | They pressed Leave |
| Red crossed-out person | Kicked | You removed them |

The count above the list shows connected players, with tab-hidden and disconnected
players counted separately. Once everyone is in, click **Start** to begin the first round.

> **Solo / offline play:** You can skip the lobby and start immediately by clicking
> **Start Solo**. No players need to be connected.

---

## 4. During a round

### Displaying a question

The GM view shows the current question title, answer options, and media.
Players see only what the GM explicitly reveals using the visibility toggles:

| Toggle | What players see |
|---|---|
| Show Question | Question title |
| Show Answers | Answer options (MC/TF only) |
| Show Media | Attached image, audio, or video |

### Navigating questions

Use the **Previous** / **Next** buttons or keyboard arrows to move between questions.
The current position (round · question) is shown in the navigation bar.
Reaching the end of a round shows a round-boundary overlay before advancing.

### Managing the buzzer

1. Click **Unlock** to open the buzzer — players can now buzz in.
2. The buzz list shows players in the order their buzzes reached you.
3. Click **Correct**, **Incorrect**, or **Skip** next to a player's name.
   - **Correct** awards points (if scoring is enabled) and optionally auto-locks.
   - **Incorrect** marks the buzz but leaves the buzzer open for others.
   - **Skip** records the buzz as skipped, with no points, and leaves the buzzer open.
4. Click **Lock** to close the buzzer manually at any time.
5. Click **Clear buzzes** to reset the list for the current question.

### Manual score adjustments

The scoreboard panel is a table of all players/teams, highest score first, with `+` and `−`
buttons. Click them to apply a one-step delta (defaulting to the lowest difficulty score).
To set an exact score, click the score, type the new value and press **Enter** (or click
elsewhere); **Esc** cancels. Score changes are broadcast to players immediately.

Every score change is logged, whether it came from `+`/`−`, a typed score or a correct
answer. Open **Score history** under the table to see the latest changes, newest first.

### Sending a message

The **Message** panel (in the lobby and during the game) sends a short plain-text note of up
to 280 characters. Pick who gets it under **To**: everyone (players and screens), all players,
the screens, one team, or one connected player. Players see it in a banner they can dismiss;
screens show it at the top until you send another message or click **Clear everywhere**.
Messages are not resent to players who join or rejoin later.

---

## 5. Timer usage

Timers can be used for timed rounds, thinking time, or dramatic effect.

### Creating a timer

1. In the GM view, open the **Timers** panel.
2. Click **Add timer**.
3. Set an optional label (e.g. `"Thinking time"`) and a duration, or pick a preset
   (30 s, 1 m, 2 m, 5 m).
4. Click **Start** on the new timer.

Every running timer is shown to all players and screens and counts down live.

### Notifications and auto-reset

Open a timer's **Timer settings** to choose:

- **Audio notification:** who hears a beep when it expires: no one, the host, players,
  or both.
- **Visual notification (popup):** who sees the expiry popup: no one, the host,
  players, or both.
- **Auto-reset on screen change:** reset the timer when the question changes, the round
  changes, either, or never.

### Controls

| Action | Effect |
|---|---|
| Start / Pause / Resume | Start the countdown, freeze it, or continue from where it paused |
| Restart | Start again from the full duration |
| Timer settings | Change the label, notifications and auto-reset |
| Delete | Remove the timer and hide it from players |

The panel header also has **Pause all** / **Resume all**, **Restart all** and
**Clear all**.

---

## 6. Ending the game

When all rounds are complete (or you choose to end early):

1. Click **End game** in the GM view and confirm.
2. Players and screens see the final scores.
3. The game stays open read-only, with the final scoreboard.

The game record remains in your local database until you delete it or purge all data
via **Settings → Data → Purge**.

**Settings → Data → Export JSON** saves your questions, games and app settings (theme, action
buttons, control size) to one file; **Import JSON** restores them.
