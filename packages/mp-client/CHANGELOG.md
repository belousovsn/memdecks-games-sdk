# Changelog — @memdecks/mp-client

All notable changes to the browser-side helper are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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
