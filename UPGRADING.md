# Upgrading the memdecks SDK

Release notes + upgrade guidance for the `@memdecks/*` packages. All changes below are
**additive** — `PROTOCOL_VERSION` is unchanged (still `1`), so nothing is force-broken and
mixed versions across the three parties (host, runtime, game) interoperate.

## What each release adds

| Package | Version | What's new |
| --- | --- | --- |
| `@memdecks/mp-types` | 0.5.0 | Card-audio response; `ResolvedCardRef.wordId` is optional for imported cards |
| `@memdecks/mp-client` | 0.4.0 | `createCardAudio(session)` storage-agnostic resolver/player |
| `@memdecks/mp-runtime` | 0.6.0 | Uses the 0.5 card contract; no runtime behavior change |
| `@memdecks/mp-types` | 0.4.0 | `GameModule.onPresenceChange?` hook; `MP_EVENTS.presence` + `MpPresencePayload` |
| `@memdecks/mp-runtime` | 0.4.0 | Lifecycle push to the platform session ledger (launch/result/abandon) |
| `@memdecks/mp-runtime` | 0.5.0 | Presence broadcast + `onPresenceChange` + `isOver` re-check on leave/return |
| `@memdecks/mp-client` | 0.3.0 | `MatchHandlers.onPresence` |

(0.3.x on runtime/types — the `/matches/:id/status` route and the `PROTOCOL_VERSION`
handshake marker — is folded into these notes.)

## Imported-card audio (0.5 types / 0.4 client)

Generic games may now receive a resolved card reference without `wordId`; `cardId` is the
stable gameplay identity. Only read `wordId` after checking it exists. Topic-pack, curated
deck, and tier-constrained games continue to receive catalog-backed cards.

Browser games should stop constructing Supabase storage URLs from `ttsFile`. The same call
now plays either an Anki attachment or generated TTS:

```ts
const audio = createCardAudio(session);
await audio.play(card); // Card, ResolvedCardRef, or card id
```

The helper uses the current scoped token, refreshes expiring signed URLs, and returns `null`
when the card has no audio. No `PROTOCOL_VERSION` bump is required: all new fields and
behaviors are optional/additive on the existing version-1 bridge.

## Does this break current games? No.

- `onPresenceChange` is an **optional** `GameModule` method — modules that don't implement
  it still satisfy the interface and compile. The runtime calls it as `?.()`, so it's a
  no-op when absent.
- `mp:presence` is a **new** server→client event. Clients that don't listen ignore it.
- `PROTOCOL_VERSION` is unchanged, so an old client ↔ new runtime (and vice-versa) still
  handshake and run.

Publishing itself upgrades no one — consumers pull versions explicitly. Note that for
`0.x` packages npm's caret is minor-locked (`^0.3.0` = `>=0.3.0 <0.4.0`), so a consumer
pinned at `^0.3.0` will **not** auto-jump to 0.4.0 on reinstall.

## Do game authors have to do anything? No (opt-in only)

Existing games keep compiling and running. To *handle a player leaving* (pause / forfeit /
"opponent left"), opt in:

```ts
// GameModule
onPresenceChange(state, playerId, present) {
  if (!present) state.forfeitedBy = playerId; // e.g. end the match when an opponent leaves
}
isOver(state) {
  return state.forfeitedBy ? { outcome: "opponent_left" } : /* ...normal end... */ null;
}
```

```ts
// client
joinMatch(handoff, {
  onState: render,
  onOver: showResult,
  onPresence: ({ players }) => showOpponentPresence(players), // { userId, seat, present }[]
});
```

## Operators running `mp-runtime`: one behavior change

Upgrading the runtime to **0.4.0+** turns on **lifecycle reporting by default**. On a match's
launch / result / abandon the runtime POSTs to `{TRANSLATOR_API_BASE}/api/games/events`,
authorized by each player's scoped card token (already on the match ticket — no admin key).

- It's **best-effort telemetry**: failures are logged once and never affect gameplay.
- **Opt out:** set `MEMDECKS_REPORT_LIFECYCLE=false`.
- **Endpoint dependency:** the Translator API you point at must expose `/api/games/events`
  (Translator-app#177). If it doesn't, the POSTs 404 — harmless, but you'll see warn logs.
  Deploy the Translator ledger to a given environment **before** upgrading that environment's
  runtimes.
- **Coming next:** per-card learning events (`card_practiced`, Translator-app#216) ride the
  same endpoint and auth; a runtime helper will land as a minor release. Custom runtimes can
  already POST them directly — one event per answered card, **unique `idempotencyKey` per
  answer**, `payload: { cardId, correct }`, no card text.

## Upgrade cleanly: bump the three `@memdecks/*` together

`mp-runtime` 0.5.0 and `mp-client` 0.3.0 both depend on `mp-types ^0.4.0`. If you upgrade the
runtime but keep `mp-types` pinned at `^0.3.0` directly, you can end up with two `mp-types`
copies and type mismatches. Bump `mp-types`, `mp-runtime`, and `mp-client` in lockstep.
