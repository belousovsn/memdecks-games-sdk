# Template: single-player game

A client-only memdecks game: no server. It is a small working quiz to replace with your
own game.

```bash
npm install
npm run dev      # http://localhost:5173, demo mode with sample cards
npm run build    # static files in dist/, host them anywhere on HTTPS
```

Outside the memdecks site no player answers, so `initGame({ demo: import.meta.env.DEV })`
gives the game twelve sample cards. Inside the site the player's real deck always wins.

It uses only `@memdecks/mp-client`:
- `initGame()`: the handshake with the site (identity, tokens, study language).
- `fetchUserCards(session)`: the player's deck.
- `createCardAudio(session)`: plays imported Anki audio or generated speech by card.

Build the game in `src/main.ts` with any framework. Keep Vite `base` at `/`. See
[`AGENTS.md`](AGENTS.md) for the checklist.
