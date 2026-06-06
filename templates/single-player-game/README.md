# Template: single-player game

A client-only memdecks game (no server). Copy this folder, rename, and build your game in
`src/main.ts`.

```bash
npm install
npm run build
```

It uses only `@memdecks/mp-client`:
- `initGame()` — the `translator:init` bridge (identity + tokens + optional cards).
- `fetchUserCards(session)` — the player's deck via the scoped token.

Wire `src/main.ts` into your framework (React, Vue, vanilla — anything). Keep Vite `base`
at `/`. See [`AGENTS.md`](AGENTS.md) for the checklist.
