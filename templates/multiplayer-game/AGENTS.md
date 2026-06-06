# Agent guide — multiplayer game template

You are implementing a memdecks **multiplayer** game. The SDK gives you transport,
lobby, matchmaking, auth, and card provisioning. **You implement one file: `src/module.ts`
(a `GameModule`).** Do not write socket, lobby, or auth code.

## Steps
1. `src/module.ts`:
   - Set `manifest.id` (must match the game's registered id), `title`, `minPlayers`
     (`1` to allow solo), `maxPlayers`, and `settingsSchema` (the lobby renders it).
   - For asymmetric games, set `manifest.roles` and use `channelsFor` for hidden info.
   - Define `State` (authoritative, server-side) and `Action` (what clients send).
   - Implement `createMatch`, `applyAction`, `viewFor`, `isOver`. Add `tick` +
     `nextDelayMs` only if the game is real-time.
2. Build a client that:
   - calls `initGame()` from `@memdecks/mp-client`, then `joinMatch(session.match!, {...})`,
   - renders `onState` views and calls `conn.sendAction(name, payload)`.
3. Register the game (id, url) with the platform (`GAME_APPS` + `games.json`).

## Rules
- `playerId` is the player's **userId**; never trust a client-supplied id, never use an admin key.
- Keep `State` authoritative on the server; clients only render `viewFor` output.
- Use the standardized `mp:action` channel (via `sendAction`), not custom event names.
- Hide opponents' secrets inside `viewFor` / `channelsFor`.

## Verify
`npm run build` must pass. Then run with `MATCH_TICKET_SECRET=dev npm start` and exercise
it with a self-signed ticket (see `examples/speed-match/smoke.mjs` for the pattern).

Reference implementation: `examples/speed-match`.
