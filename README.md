# memdecks-games-sdk

SDK and shared contracts for building **single- and multiplayer games** on the memdecks
platform. Games run in an iframe inside the Translator app, authenticate via a
postMessage bridge, and (for multiplayer) run their realtime session on an
`mp-runtime` server — self-hosted by the game's operator.

> Architecture rationale lives in the private core repo at
> `translator/rnd/multiplayer-platform-plan.md`. This repo is the **public** half:
> the contract + engine + templates external developers depend on.

## Packages

| Package | Role | Status |
|---|---|---|
| [`@memdecks/mp-types`](packages/mp-types) | Zero-dep contracts: bridge messages, `Card`, `GameModule`, match tickets, gameplay protocol | ✅ implemented |
| [`@memdecks/mp-runtime`](packages/mp-runtime) | Tier-2 game session engine (Socket.IO, lobby/match lifecycle, ticket verify, per-player views, card provisioning, word translation) | ✅ implemented |
| [`@memdecks/mp-client`](packages/mp-client) | Game-side helper: bridge receiver + authenticated socket + join-by-ticket + single-player card fetch | ✅ implemented |

## Mental model

- **Platform (memdecks, private):** identity + content API. Issues scoped card tokens
  and signed match tickets.
- **Platform Lobby (memdecks, private):** presence, matchmaking, settings, forms matches,
  hands off via signed ticket.
- **Game runtime (this SDK):** runs the actual match. Self-hosted by the operator
  (your VPS, ours, or a first-party hub). Verifies the ticket; never needs to call back
  to the platform.
- **A game author writes one thing:** a `GameModule` (rules) + a thin client. Everything
  else — lobby, transport, auth, cards — comes from the SDK.
- **Cross-language play:** players study different languages. From an async `createMatch`,
  call `ctx.translate(words, languages)` to localize the cards a match picked — see
  [AGENTS.md](AGENTS.md#cross-language-play-ctxtranslate).

See [AGENTS.md](AGENTS.md) for the contract summary aimed at LLM coding agents.

## Develop

```bash
npm install
npm run build      # builds the three packages (dependency-ordered)
```

## Build a game

| Start from | When |
|---|---|
| [`templates/single-player-game`](templates/single-player-game) | client-only game (no server) |
| [`templates/multiplayer-game`](templates/multiplayer-game) | multiplayer (you write one `GameModule`) |
| [`examples/speed-match`](examples/speed-match) | full working multiplayer reference |
| [`examples/hub`](examples/hub) | run several first-party games in one process |

Agents: see [CLAUDE.md](CLAUDE.md) and each template's `AGENTS.md`.

## Publishing & keeping the contract in sync

The integration contract lives in these packages, and **both** external games **and** the
private memdecks core depend on them — so the contract can't drift.

1. Publish the packages (public npm): `@memdecks/mp-types`, then `@memdecks/mp-runtime`
   and `@memdecks/mp-client`. (`npm publish -w <pkg>`; they're already
   `publishConfig.access: public`.)
2. In the private Translator repo, replace the **inlined** contract copies with the
   published types and add `@memdecks/mp-types` as a dependency:
   - `server/src/services/gameTokenService.ts` → `TicketPlayer`/ticket claim shapes.
   - `lobby/src/types.ts` → `MatchedPlayer`, `MatchHandoff`.
   - the Translator client's `translator:init` sender → bridge message types.
3. Games depend on the published packages; the VPS `npm ci` pulls them on deploy.

A contract change is then: edit the package → bump + publish → the core bumps its dep
(a reviewed step). No private→public file mirroring, so nothing private leaks.
