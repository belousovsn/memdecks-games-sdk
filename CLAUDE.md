# CLAUDE.md — building memdecks games with an agent

This repo is the **public SDK** for building single- and multiplayer games on the memdecks
platform. If you're an agent asked to build a game, start here.

## Pick a path
- **Single-player** (no server): copy `templates/single-player-game/`. You only write a
  client that calls `initGame()` + `fetchUserCards()`. Guide: that folder's `AGENTS.md`.
- **Multiplayer**: copy `templates/multiplayer-game/`. You write one `GameModule`
  (`src/module.ts`); the SDK does transport/lobby/auth/cards. Guide: that folder's
  `AGENTS.md`. Full reference: `examples/speed-match/`.

## Packages (what you import)
- `@memdecks/mp-types` — contracts (`Card`, `GameModule`, `MatchHandoff`, `MP_EVENTS`, …).
- `@memdecks/mp-runtime` — `createMultiplayerServer({ game })` (or `{ games: [...] }` for a hub).
- `@memdecks/mp-client` — `initGame`, `joinMatch`, `fetchUserCards`.

## The model in one breath
A game is an iframe in the Translator host. It gets identity + cards via a postMessage
bridge. Multiplayer games also open a Socket.IO connection to an `mp-runtime` server using
a signed **match ticket** the platform lobby issues. You implement the rules
(`GameModule`); everything else is the SDK.

## Hard rules
1. Player identity is the platform-provided **userId** — never trust a client-sent id,
   never embed an admin key in a game.
2. Solo is a 1-seat match; the switch is `manifest.minPlayers`.
3. Server `State` is authoritative; clients render `viewFor` output and send `mp:action`.
4. Hide opponents' secrets in `viewFor` / `channelsFor`.

## Commands
```bash
npm install
npm run build          # builds the three packages (dependency-ordered)
# build a game/template/example: npm run build -w <package-name>
```

## Verify your game
- Build must pass.
- Multiplayer: run with `MATCH_TICKET_SECRET=dev npm start` and drive it with a
  self-signed ticket — copy `examples/speed-match/smoke.mjs`.
- Single-player: build and load in the host (or run standalone for the "no session" path).

More detail for game authors is in [AGENTS.md](AGENTS.md).
