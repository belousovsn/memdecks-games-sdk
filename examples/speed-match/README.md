# Example: Speed Match (multiplayer)

A complete reference `GameModule` — copy it when building a memdecks multiplayer game.
Each round shows a foreign word; players race to tap the matching English card. First
correct answer (or all players answering, or the round timer) advances the round.

It exercises every part of the contract:
- **settings schema** (`rounds`, `roundMs`, `language`) — rendered by the platform lobby
- **cards** — built from `MatchContext.cards` (union of players' decks)
- **real-time loop** — `tick` advances on timeout, `nextDelayMs` arms the round timer
- **scoring + `isOver`** — returns a `GameResult` with per-user scores
- **solo and multiplayer** — `minPlayers: 1`, `maxPlayers: 4`, symmetric (no roles)

## Files
- [`src/module.ts`](src/module.ts) — the `GameModule` (the only file you really write).
- [`src/server.ts`](src/server.ts) — standalone entry: `createMultiplayerServer({ game })`.
- [`smoke.mjs`](smoke.mjs) — drives a full match through the runtime (no platform needed).

## Run it
```bash
npm run build -w @memdecks/example-speed-match
# standalone server (needs MATCH_TICKET_SECRET or MATCH_JWKS_URL):
MATCH_TICKET_SECRET=dev-secret PORT=4601 npm start -w @memdecks/example-speed-match
# or the end-to-end smoke (self-signs an HS256 ticket, plays 2 rounds):
node examples/speed-match/smoke.mjs
```

## Client side (sketch)
```ts
import { initGame, joinMatch } from "@memdecks/mp-client";
const { session } = await initGame();
const conn = joinMatch(session!.match!, {
  onState: (view) => render(view),          // { prompt, choices, scores, round, ... }
  onOver: ({ result }) => showScores(result),
});
// on choice tap:
conn.sendAction("answer", { cardId });
```

The module ships as the default export of this package, so a hub can mount it:
`import { speedMatchModule } from "@memdecks/example-speed-match";`
