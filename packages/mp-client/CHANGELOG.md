# Changelog — @memdecks/mp-client

All notable changes to the browser-side helper are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## 0.5.0 — 2026-10-08

### Added
- `createCardAudio(session)` also takes a word: `audio.play({ text, lang })`. Use it for a
  word the player holds no card for, such as one drafted from a co-player's deck or one
  that `ctx.translate` / `ctx.translateSenses` gave the match. The platform answers card
  audio only to the card's owner, so these words were silent. `WordAudioRef` is exported.
- A word whose audio is still being synthesized resolves as `unavailable` and is asked
  again after 30 seconds. A platform without the word-audio route answers 404, which is
  also `unavailable`.

## 0.4.0 — 2026-08-14

### Added
- `createCardAudio(session)` with `resolve(card)`, `play(card)`, `stop()`, and `clear()`.
  Games pass a card or card id; the platform chooses imported audio or generated TTS,
  performs ownership checks, and returns a playable URL. Signed URLs are cached only
  until shortly before their expiry and refreshed tokens are read from the live session.

### Changed
- Bumped `@memdecks/mp-types` to `^0.5.0` for `CardAudioResponse` and optional imported
  card `wordId` support.

## 0.3.0 — 2026-06-30

Presence / opponent-left handling (Translator-app#188). Additive.

### Added
- **`MatchHandlers.onPresence`** — a `joinMatch` handler invoked on `mp:presence`
  (`MpPresencePayload`), so a game can show "opponent left" / "reconnecting" when a
  rostered player drops or returns mid-match.

### Changed
- Bumped `@memdecks/mp-types` dependency to `^0.4.0` (requires `MP_EVENTS.presence`).

### Migration
- No changes required. Existing games that don't pass `onPresence` are unaffected.
