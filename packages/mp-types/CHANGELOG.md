# Changelog — @memdecks/mp-types

All notable changes to the shared contracts package are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## 0.5.0 — 2026-08-14

Card-first audio and imported-card compatibility (Translator-app#271). Additive wire
change; `PROTOCOL_VERSION` remains `1`.

### Added
- `CardAudioResponse`, the platform response shared by imported audio and generated TTS.

### Changed
- `ResolvedCardRef.wordId` is optional and accepts the numeric catalog ids sent by the
  core app. A card imported from Anki can now participate in a generic game before it is
  matched to the catalog; games with topic/deck/tier requirements still receive only
  catalog-backed cards.

## 0.4.0 — 2026-06-30

Presence / opponent-left contract (Translator-app#188). Additive and backward
compatible — **no `PROTOCOL_VERSION` bump** (a new optional `GameModule` method and a
new server→client event; existing games keep compiling and running).

### Added
- **`GameModule.onPresenceChange?(state, playerId, present)`** — optional hook the
  runtime calls when a rostered player drops or returns mid-match. A game can pause,
  forfeit, or surface "opponent left" by mutating state here; the runtime then
  re-broadcasts and re-checks `isOver`. Without it, `isOver` only fires on game state,
  so a vanished player can leave the other hanging.
- **`MP_EVENTS.presence` (`mp:presence`) + `MpPresencePayload`** — server→client roster
  presence (`{ userId, seat, present }[]`), broadcast when a player leaves or returns,
  so a client can show presence without threading it through `viewFor`.

### Note
- Documents 0.3.0 as well (the `PROTOCOL_VERSION` handshake marker), which shipped
  without its own changelog entry.

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
