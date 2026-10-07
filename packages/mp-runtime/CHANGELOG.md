# Changelog — @memdecks/mp-runtime

All notable changes to the game session engine are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## 0.8.0 — 2026-10-07

Cards of a pair without English (Translator-app#565).

### Changed
- `defaultCardProvider` and `normalizeCardRow` keep a card saved between two non-English
  languages. It used to be dropped. Its `english` is the English dictionary form of the
  meaning (`source_lemma`), and `prompt` / `promptLanguage` hold the word in the player's
  base language. Every card now has `prompt`.
- `CardProviderArgs.baseLanguage` carries the player's base language from the ticket.
- Bumped `@memdecks/mp-types` to `^0.7.0`.

### Migration
- Show `card.prompt ?? card.english` where the game shows a card to its owner. Keep
  pooling and matching by `english` (with `senseKey`).
- To show a card to another player, translate it into that player's `baseLanguage` with
  `ctx.translateSenses`, the same call that gives the study-language word.

## 0.6.0 — 2026-08-14

### Changed
- Bumped `@memdecks/mp-types` to `^0.5.0` so runtime consumers share the optional
  `ResolvedCardRef.wordId` and card-audio response contract. Runtime behavior is unchanged.

## 0.5.0 — 2026-06-30

Presence / opponent-left handling (Translator-app#188). Additive — no
`PROTOCOL_VERSION` change.

### Added
- **Mid-match presence.** When a rostered player drops or returns after the match has
  started, the runtime now calls the game's optional `onPresenceChange(state, playerId,
  present)`, broadcasts the roster's presence as `mp:presence`, and re-checks `isOver`.
  A game can pause, forfeit, or surface "opponent left" by mutating state in the hook —
  e.g. ending the match when an opponent abandons, instead of leaving the other player
  hanging (previously `isOver` only fired on game state).

### Changed
- Bumped `@memdecks/mp-types` dependency to `^0.4.0` (requires `onPresenceChange` +
  `MP_EVENTS.presence`).

### Migration
- No code changes required for existing games. Games that don't implement
  `onPresenceChange` are unaffected except that clients now also receive `mp:presence`
  updates (safe to ignore).

## 0.4.0 — 2026-06-30

Lifecycle reporting to the platform session ledger (Translator-app#177). Additive —
no wire-contract (`PROTOCOL_VERSION`) change; this is runtime→platform HTTP, not the
game↔runtime protocol.

### Added
- **Lifecycle push.** The runtime now pushes `launch` / `result` / `abandon` per
  player to `POST {apiBase}/api/games/events`, authorized by that player's scoped
  card token (no admin key in the runtime). This feeds the server-owned game session
  ledger and lets the platform detect "match over" proactively instead of polling
  `/matches/:id/status`. `launch` fires when the match starts, `result` when
  `isOver` returns a result, `abandon` when everyone leaves an unfinished match.
- **`createHttpReporter` / `noopReporter`** plus `LifecycleReporter`, `LifecycleEvent`,
  `LifecycleEventType`, `HttpReporterOptions` exports. Inject a custom reporter via the
  new `lifecycleReporter` option on `createMultiplayerServer` (used by the smoke).
- **`MEMDECKS_REPORT_LIFECYCLE` env flag** (`RuntimeEnv.reportLifecycle`) — default
  **on**; set to `0`/`false`/`off` to disable. Reporting is best-effort telemetry:
  push failures are logged once and never affect gameplay.

### Migration
- No code changes required for existing games. Operators who don't want their runtime
  reporting to the platform can set `MEMDECKS_REPORT_LIFECYCLE=false`. The match ticket
  already carries each player's `cardToken`, which now also authorizes the push.

### Note
- This documents 0.3.1 as well (the prior `GET /matches/:matchId/status` liveness route),
  which shipped without its own changelog entry.

## 0.3.0 — 2026-06-12

Cross-language / translation support and lobby manifest export. All additive.

### Added
- **`ctx.translate` provisioning.** A default `defaultTranslateProvider` (plus
  exported `TranslateProvider` / `TranslateProviderArgs` types) proxies
  `POST {apiBase}/api/cards/translate` using the match's scoped card token — so
  no admin key lives in any game. Override it via the new `translateProvider`
  option on `createMultiplayerServer`.
- **`GET /manifest` endpoint.** Returns the array of each loaded module's
  manifest (settings schema, player counts, roles) for the platform lobby to
  import.

### Changed
- **Async `createMatch` is now awaited.** The runtime holds the match in a
  waiting state until `createMatch` settles, so games can call `ctx.translate`
  during setup. Start is guarded against re-entry (a second join mid-setup will
  not start the match twice), and a setup failure emits an error to the room
  instead of crashing.
- Bumped `@memdecks/mp-types` dependency to `^0.2.0` (requires the new
  `TranslateFn` contract).

### Migration
- No code changes required for existing games. Synchronous `createMatch`
  implementations continue to work unchanged. To localize cards across
  languages, make `createMatch` `async` and call `ctx.translate(words, languages)`.
