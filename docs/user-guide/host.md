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

Go to **Settings → Difficulties** to define point values for your game.
The defaults are Easy (5 pts), Medium (10 pts), and Hard (15 pts).
You can rename them, change their colours, and adjust their scores.

### Tags

Go to **Settings → Tags** to create classifiers for your questions.
Tags are used for filtering — you can include or exclude by tag when browsing questions.
Example tags: `History`, `Pop Culture`, `Music`, `Local`.

### Adding questions

Go to **Questions → Add Question**. Fill in:

| Field       | Required | Notes                                               |
| ----------- | -------- | --------------------------------------------------- |
| Title       | ✓        | The question text shown to players                  |
| Type        | ✓        | See question types below                            |
| Answer      | ✓        | Correct answer (not shown to players automatically) |
| Difficulty  | —        | Determines point value on correct buzz              |
| Tags        | —        | Multi-select; used for filtering                    |
| Description | —        | Markdown body (flavour text, citations)             |
| Media       | —        | Upload an image, audio, or video file               |

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

### Configure the game

On the game settings panel you can configure:

| Option                     | What it does                                                 |
| -------------------------- | ------------------------------------------------------------ |
| Transport mode             | `Auto` (PeerJS → Gun fallback), `PeerJS only`, or `Gun only` |
| Scoring enabled            | Award points automatically on correct buzz adjudication      |
| Auto-lock on first correct | Lock the buzzer after the first correct ruling               |
| Allow false starts         | Record buzzes that arrive while the buzzer is locked         |
| Buzz deduplication         | `First only` (one buzz per player per question) or `All`     |

---

## 3. Running a game

Open a game and click **Start Game** to enter the GameMaster (GM) view.

### Sharing the room

When the game starts, a room code and QR code are generated.

```
Room:       XK7RQZ
Passphrase: tiger-lamp-cloud-seven
```

Players can join by:

- Scanning the QR code with their phone camera.
- Visiting the Viktorani URL and entering the room code manually.

The QR code links directly to the join page with the room and passphrase pre-filled.

### Lobby

The GM sees a list of connected players in real time. Each player appears as they join.
Once everyone is in, click **Start** to begin the first round.

> **Solo / offline play:** You can skip the lobby and start immediately by clicking
> **Start Solo**. No players need to be connected.

---

## 4. During a round

### Displaying a question

The GM view shows the current question title, answer options, and media.
Players see only what the GM explicitly reveals using the visibility toggles:

| Toggle        | What players see                |
| ------------- | ------------------------------- |
| Show Question | Question title                  |
| Show Answers  | Answer options (MC/TF only)     |
| Show Media    | Attached image, audio, or video |

### Navigating questions

Use the **Previous** / **Next** buttons or keyboard arrows to move between questions.
The current position (round · question) is shown in the navigation bar.
Reaching the end of a round shows a round-boundary overlay before advancing.

### Managing the buzzer

1. Click **Unlock** to open the buzzer — players can now buzz in.
2. The buzz list shows players in arrival order (timestamp-sorted).
3. Click **Correct**, **Incorrect**, or **Skip** next to a player's name.
   - **Correct** awards points (if scoring is enabled) and optionally auto-locks.
   - **Incorrect** marks the buzz but leaves the buzzer open for others.
   - **Skip** dismisses the buzz without recording a ruling.
4. Click **Lock** to close the buzzer manually at any time.
5. Click **Clear buzzes** to reset the list for the current question.

### Manual score adjustments

The scoreboard panel shows all players/teams with `+` and `−` buttons.
Click them to apply a one-step delta (defaulting to the lowest difficulty score).
Score changes are broadcast to players immediately.

---

## 5. Timer usage

Timers can be used for timed rounds, thinking time, or dramatic effect.

### Creating a timer

1. In the GM view, open the **Timers** widget.
2. Click **Add Timer**.
3. Set the label (e.g. `"Thinking time"`), duration in seconds, and target audience.
4. Click **Start**.

The timer is broadcast to all players (or a specific team) and counts down live.

### Controls

| Action        | Effect                                    |
| ------------- | ----------------------------------------- |
| Pause         | Freeze the countdown at its current value |
| Resume        | Continue from where it paused             |
| Reset         | Return to the full duration               |
| Stop / Remove | End the timer and hide it from players    |

---

## 6. Ending the game

When all rounds are complete (or you choose to end early):

1. Click **End Game** in the GM view.
2. The scoreboard widget shows the final rankings.
3. Click **Export Results** to download a JSON file with all scores and buzz history.

The game record remains in your local database until you delete it or purge all data
via **Settings → Database → Purge**.
