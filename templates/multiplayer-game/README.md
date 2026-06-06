# Template: multiplayer game

Copy this folder, rename the package, and implement `src/module.ts`. The SDK provides
everything else (transport, lobby, matchmaking, auth, cards).

```bash
npm install
npm run build
MATCH_TICKET_SECRET=dev-secret PORT=4601 npm start
```

- `src/module.ts` — your `GameModule` (the only file you really write).
- `src/server.ts` — standalone entry (`createMultiplayerServer`). For first-party games
  hosted on the hub, you instead add your module to the hub's `games: [...]` array.
- Client side: use `@memdecks/mp-client` (`initGame` → `joinMatch` → `sendAction`).

See [`AGENTS.md`](AGENTS.md) for the step-by-step, and `examples/speed-match` for a full
working reference.
