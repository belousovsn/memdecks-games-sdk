# Agent guide — single-player game template

You are implementing a memdecks **single-player** game. There is **no server and no
GameModule** — it's a client that runs in an iframe, gets the user's cards, and plays
locally.

## Steps
1. In `src/main.ts`: `initGame()` → if `session` is null, show "open from Translator";
   else `fetchUserCards(session)` to get the deck.
2. Build your game UI (any framework) using the `Card[]`.
3. Call `close()` when the player exits.
4. Register the game (id, url) with the platform (`GAME_APPS` + `games.json`). No
   multiplayer fields needed.

## Rules
- Keep Vite `base` at `/`. Use `apiBase` from the session for any extra API calls.
- `gameToken` (scoped) is preferred for API calls; `accessToken` is available for
  Supabase TTS.
- Do not add multiplayer code — no sockets, no tickets.

## Verify
`npm run build` must pass. Load the built client in the Translator host (or run
standalone to see the "no session" path).
