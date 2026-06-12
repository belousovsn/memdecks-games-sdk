# Agent guide — building a memdecks game

This file orients an LLM coding agent (or human) building a game on this SDK. It will
grow as packages land; today it covers the **contract** (`@memdecks/mp-types`).

## The 30-second model

A game is an iframe loaded by the Translator host. It receives identity + cards over a
postMessage bridge. For multiplayer, it also opens a Socket.IO connection to an
`mp-runtime` server using a signed **match ticket** the platform lobby issued.

You implement **one interface** — `GameModule` — plus a thin client. The runtime owns
transport, lobby, auth, card provisioning, and broadcasting.

## Contract surface (`@memdecks/mp-types`)

- **`GameModule<State, Action>`** — the rules. Key methods:
  - `manifest` — `id`, `title`, `minPlayers`/`maxPlayers` (set `minPlayers: 1` to allow
    solo), optional `roles`, `settingsSchema`, `requiresCards`.
  - `createMatch(ctx)` — build initial `State` from roster + settings + per-player `cards`.
    May be **async** (`State | Promise<State>`) — e.g. to `await ctx.translate(...)`. The
    runtime holds the match in a waiting state until the promise settles.
  - `applyAction(state, playerId, action)` — handle a discrete action. `playerId` is the
    player's **userId** (stable across reconnects), never a socket id.
  - `tick?(state)` + `nextDelayMs?(state)` — optional real-time loop: `tick` advances
    time-based state when the timer fires; `nextDelayMs` says when to fire next.
  - `viewFor(state, playerId)` — per-player view (hide opponents' secrets here).
  - `channelsFor?(state, playerId)` — optional extra per-player channels.
  - `isOver(state)` — return a `GameResult` when finished.
- **Bridge messages** — `TranslatorInitMessage` (host → game), `GameToParentMessage`
  (game → host: `game:ready`, `game:close`, `game:result`).
- **Match** — `MatchHandoff` (in `translator:init.match`) and `MatchTicketClaims`
  (verified server-side).
- **Gameplay protocol** — `MP_EVENTS` + payloads. Use the standardized `mp:action`
  channel, not custom event names.
- **Cards** — `Card`, `CardTranslation`, `LanguageCode`.
- **Translation** — `TranslateFn` (`ctx.translate`); see *Cross-language play* below.

## Rules of the road

1. Player identity is **userId**, supplied by the platform — never trust a client-sent
   userId, and never put an admin key in a game.
2. Solo is just a 1-seat match. The single switch is `manifest.minPlayers`.
3. Symmetric game → omit `roles`. Asymmetric (e.g. bandit/inspector) → declare `roles`
   and use `channelsFor` for hidden info.
4. Keep `State` authoritative on the server; clients only render `viewFor` output and
   send actions.

## Cross-language play (`ctx.translate`)

Players study different languages, so two people in one match may know the same card
under different words. `ctx.translate` lets a game localize **just the cards it picked**
at match setup — platform-backed and lookup-only, so no admin key lives in the game.

`MatchedPlayer.language` (e.g. `"gr"`) tells you each player's study language. From an
**async** `createMatch`, look up the words you need in the languages you need:

```ts
async createMatch(ctx: MatchContext): Promise<State> {
  const langs = [...new Set(ctx.players.map((p) => p.language).filter(Boolean))];
  const words = pickWords(ctx.cards);            // the English words this match uses

  // translate?: present only when the runtime has a provider configured.
  const t = ctx.translate ? await ctx.translate(words, langs as string[]) : {};

  // t[word][lang] is a CardTranslation, or null when the platform has none.
  const labelFor = (word: string, lang?: string) =>
    (lang && t[word]?.[lang]?.text) || word;     // fall back to English

  return buildState(ctx, labelFor);
}
```

Notes:
- `ctx.translate` is **absent** when the runtime has no translate provider — always guard.
- It returns `null` per word/language the platform can't translate; fall back to English.
- Call it **once** in `createMatch` for the words you actually use; it is not a per-frame API.

## Client quickstart (`@memdecks/mp-client`)

```ts
import { initGame, joinMatch, fetchUserCards } from "@memdecks/mp-client";

const { session, close } = await initGame();      // handles game:ready + translator:init

// Single-player:
const cards = await fetchUserCards(session!);

// Multiplayer / solo match:
const conn = joinMatch(session!.match!, {
  onState: (view) => render(view),
  onOver: ({ result }) => showResult(result),
});
conn.sendAction("guess", { fieldId, seq });
```

## Status

- ✅ `@memdecks/mp-types` — contracts.
- ✅ `@memdecks/mp-runtime` — game session engine (standalone + hub).
- ✅ `@memdecks/mp-client` — bridge + match join + single-player card fetch.
- 🚧 Templates + reference example games — incoming.
