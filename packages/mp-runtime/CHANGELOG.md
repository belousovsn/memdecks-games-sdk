# Changelog — @memdecks/mp-runtime

All notable changes to the game session engine are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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
