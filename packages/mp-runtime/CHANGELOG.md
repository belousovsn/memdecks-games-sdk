# Changelog — @memdecks/mp-runtime

All notable changes to the game session engine are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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
