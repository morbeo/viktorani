# Viktorani

Bar trivia PWA with WebRTC multiplayer, Reveal.js slides, and buzzer gameplay. No backend — runs entirely in the browser.

**Live:** https://morbeo.github.io/viktorani/

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- vite-plugin-pwa
- Reveal.js — question presentation
- Dexie.js — IndexedDB (questions, games, notes)
- PeerJS — WebRTC multiplayer (Option A)
- Gun.js + SEA — decentralized encrypted multiplayer (Option B)

## Multiplayer modes

| Mode | How |
|---|---|
| PeerJS | WebRTC peer-to-peer via PeerJS signaling |
| Gun.js | Decentralized relay with SEA encryption |
| Auto | Tries PeerJS first, falls back to Gun.js |

The host generates a Room ID and passphrase. Players scan a QR code to join.
All game state flows browser-to-browser — no server involved after the initial handshake.

## Development

```bash
npm install --legacy-peer-deps
npm run dev
```

## Deploy

Push to `master` — GitHub Actions builds and deploys to GitHub Pages automatically.

## Data

All data lives in IndexedDB (Dexie.js) on the host device.
Export/import via JSON snapshots from the Settings page.
