# Changelog — @memdecks/mp-types

All notable changes to the shared contracts package are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## 0.2.0 — 2026-06-12

Cross-language / translation contracts. All additive and backward compatible.

### Added
- `TranslateFn` — platform-backed, lookup-only word translation. Given
  `words: string[]` and target `languages: string[]`, returns the translation
  of each word in each requested language (or `null` where none is stored).
  Intended to be called from `createMatch` to localize just the cards a match
  picked — e.g. showing one player's card to a co-player studying a different
  language.
- `MatchContext.translate?: TranslateFn` — optional provider handed to
  `createMatch`; absent when the runtime has no translate provider configured.
- `MatchedPlayer.language?: string` — the player's study language from their
  account settings (e.g. `"gr"`), when known.

### Changed
- `GameModule.createMatch` may now return `State | Promise<State>`. Existing
  synchronous games are unaffected — returning `State` still satisfies the type.
