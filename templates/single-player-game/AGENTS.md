# Agent guide — single-player game template

You are implementing a memdecks **single-player** game. There is **no server and no
GameModule**: it's a client that runs in an iframe, gets the user's cards, and plays
locally.

## Steps
1. In `src/main.ts`: `initGame({ demo: import.meta.env.DEV })`. In dev it falls back to
   sample cards; in production a null `session` means "open from memdecks.com".
2. `fetchUserCards(session)` gives the deck. Show `card.prompt ?? card.english` and
   `card.translations[session.targetLang].word`.
3. Build your game UI (any framework) using the `Card[]`, replacing `startGame`.
4. Call `close()` when the player exits.
5. Host the build on HTTPS and ask for it to be listed (see the root README).

## Rules
- Keep Vite `base` at `/`. Use `apiBase` from the session for any extra API calls.
- Use `createCardAudio` for sound; never build storage URLs yourself.
- Do not add multiplayer code: no sockets, no tickets.

## Verify
`npm run build` must pass. `npm run dev` must play a full round with the demo deck.
