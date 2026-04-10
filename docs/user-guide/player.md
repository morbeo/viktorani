# Player Guide

How to join and play a Viktorani trivia game.

---

## Contents

1. [Joining a game](#1-joining-a-game)
2. [Online play](#2-online-play)
3. [Offline / no-device play](#3-offline--no-device-play)
4. [Troubleshooting](#4-troubleshooting)

---

## 1. Joining a game

Your host will display a QR code or read out a room code at the start of the game.

### Option A — Scan the QR code

1. Open your phone's camera app and point it at the QR code.
2. Tap the link that appears — it opens Viktorani in your browser.
3. Your name field is pre-filled from a previous session (if any); edit it if needed.
4. Tap **Join**.

### Option B — Enter the room code manually

1. Open **https://morbeo.github.io/viktorani/** in your browser.
2. Tap **Join Game**.
3. Enter the six-character room code (e.g. `XK7RQZ`) — it's not case-sensitive.
4. Enter the passphrase shown by your host (e.g. `tiger-lamp-cloud-seven`).
5. Enter your name and tap **Join**.

> **Teams:** If your host has configured team play, you'll be assigned to a team
> during the lobby phase. Your host will tell you which team you're on.

---

## 2. Online play

Once you've joined, you'll see the **Player view**. The game progresses as the GM
navigates through questions.

### What you see

The GM controls what's visible to you:

| GM toggles on | You see                                       |
| ------------- | --------------------------------------------- |
| Show Question | The question text                             |
| Show Answers  | Answer options (multiple choice / true-false) |
| Show Media    | An image, audio clip, or video                |

### Buzzing in

When the GM unlocks the buzzer, a **Buzz** button appears.

1. Tap **Buzz** as fast as you can.
2. Your buzz is recorded with a high-precision timestamp.
3. The GM sees buzzes in arrival order and rules each one: Correct / Incorrect / Skip.
4. If your buzz is ruled Incorrect, the buzzer may reopen for others depending on the game settings.

### Scoreboard

The scoreboard updates live after each adjudication.
Scores are sorted in descending order so you can see the rankings at a glance.

### Timers

If the GM starts a countdown timer, it appears on your screen automatically and counts down.
You cannot pause or reset timers — only the GM can control them.

---

## 3. Offline / no-device play

Viktorani supports games where some teams share one device, or where players have no device at all.

### Shared-device teams

If your team shares a single phone:

1. One person joins Viktorani as the team representative.
2. The rest of the team huddles around and discusses answers together.
3. The representative buzzes in and the GM hears the team's answer.

### Paper / no-device teams

For venues with poor connectivity or players without smartphones:

1. Each no-device team designates a scorekeeper.
2. The host (GM) manages that team's score manually using the scoreboard `+` / `−` buttons.
3. Buzzes for no-device teams are entered by the GM directly using manual score adjustment.

### Planned: QR answer submission

A future version of Viktorani will let the GM display a per-question QR code.
Players with no app installed will be able to scan it and submit an answer via a
lightweight one-page form — no join flow required. This is designed for pub settings
where some guests prefer not to install anything.

---

## 4. Troubleshooting

### The QR code won't scan

- Make sure your camera app supports QR scanning (most modern phones do natively).
- Increase the screen brightness on the host's display.
- Try **Option B** (manual room code) instead.

### I entered the room code but can't connect

- Double-check the room code — the character set avoids `0`, `1`, `I`, and `O`
  to prevent confusion, so `0` and `O` are never valid characters.
- Make sure the passphrase matches exactly, including hyphens (e.g. `tiger-lamp-cloud-seven`).
- Ask your host to confirm the game has started (not still in lobby setup).

### My connection dropped mid-game

- Refresh the page and re-join using the same room code and passphrase.
- Your name and score are preserved in the host's session.
- If the host's transport mode is `Gun.js`, the connection will re-establish automatically
  within a few seconds without needing to re-join.

### I can't hear the timer / media

- Check that your device volume is not muted.
- Some browsers block autoplay of audio until the user has interacted with the page.
  Tap anywhere on the screen once and the audio should start.

### The wrong passphrase error

- Passphrases are case-insensitive but must include the hyphens between words.
- If you're on the Gun.js transport, the passphrase is used for encryption —
  a mismatch means you won't receive any events, not that connection fails outright.
  Ask your host to confirm the passphrase and re-join.
