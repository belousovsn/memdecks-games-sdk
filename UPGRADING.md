# Upgrading the memdecks SDK

Release notes + upgrade guidance for the `@memdecks/*` packages. All changes below are
**additive** — `PROTOCOL_VERSION` is unchanged (still `1`), so nothing is force-broken and
mixed versions across the three parties (host, runtime, game) interoperate.

## What each release adds

| Package | Version | What's new |
| --- | --- | --- |
| `@memdecks/mp-client` | 0.5.0 | `createCardAudio` plays a word by text and language: `audio.play({ text, lang })` |
| `@memdecks/mp-types` | 0.6.0 | Card meaning: `Card.senseKey/senseGloss/sourceLemma`, `CardTranslation.senseKey/briefGloss`, `ctx.translateSenses` |
| `@memdecks/mp-runtime` | 0.7.0 | `ctx.translateSenses` provider, `senseRequestFor(card)`; `defaultCardProvider` normalizes `/api/cards` rows |
| `@memdecks/mp-client` | 0.4.1 | Depends on `mp-types ^0.6.0`; no behavior change |
| `@memdecks/mp-types` | 0.7.0 | `Card.prompt` / `promptLanguage`, `MatchedPlayer.baseLanguage`, `uiLocale` / `explanationLang` in `translator:init` |
| `@memdecks/mp-runtime` | 0.8.0 | Cards of a pair without English are kept and prompted in the player's base language |
| `@memdecks/mp-client` | 0.4.2 | Uses the 0.7 types; no behavior change |
| `@memdecks/mp-types` | 0.5.0 | Card-audio response; `ResolvedCardRef.wordId` is optional for imported cards |
| `@memdecks/mp-client` | 0.4.0 | `createCardAudio(session)` storage-agnostic resolver/player |
| `@memdecks/mp-runtime` | 0.6.0 | Uses the 0.5 card contract; no runtime behavior change |
| `@memdecks/mp-types` | 0.4.0 | `GameModule.onPresenceChange?` hook; `MP_EVENTS.presence` + `MpPresencePayload` |
| `@memdecks/mp-runtime` | 0.4.0 | Lifecycle push to the platform session ledger (launch/result/abandon) |
| `@memdecks/mp-runtime` | 0.5.0 | Presence broadcast + `onPresenceChange` + `isOver` re-check on leave/return |
| `@memdecks/mp-client` | 0.3.0 | `MatchHandlers.onPresence` |

(0.3.x on runtime/types — the `/matches/:id/status` route and the `PROTOCOL_VERSION`
handshake marker — is folded into these notes.)

## Audio for a word the player has no card for (0.5 client)

In a match one player often sees a word from another player's deck, or a word the platform
translated for the match. The platform answers card audio only to the card's owner, so
`audio.play(card)` cannot speak such a word. Ask for it by text and language:

```ts
const audio = createCardAudio(session);
// The player's own card: by card, as before.
await audio.play(card);
// A word they hold no card for: the study word they see, in their study language.
await audio.play({ text: "կատու", lang: "hy" });
```

The server side of the game decides which one applies and sends it in the view: the card id
when the player owns the card, otherwise the word and its language. `ctx.translate` and
`ctx.translateSenses` queue speech for the words they return, so the audio is usually ready
by the time the match shows the word. Until then `play` returns `null`, and the answer is
asked again after 30 seconds.

## Players who do not read English (0.7 types / 0.8 runtime)

A player can study Armenian from Russian. Their cards have no English side, and the
runtime used to drop them, so such a player arrived in a game with an empty deck.

- `Card.english` is the concept key for every player. On a Russian → Armenian card it is
  the English dictionary form of the meaning the card was saved on. Keep pooling and
  matching by it.
- `Card.prompt` is the word the card's owner reads, in `Card.promptLanguage`. On an
  English-base card it equals `english`. Show `card.prompt ?? card.english`.
- `MatchedPlayer.baseLanguage` is the language a player reads prompts in. Absent means
  English.
- To show a card to a player who did not bring it, translate it into that player's
  `baseLanguage`:

```ts
const langs = [...new Set(ctx.players.flatMap((p) => [p.language, p.baseLanguage]))]
  .filter((lang): lang is string => !!lang && lang !== "en");
const results = await ctx.translateSenses!(picked.map(senseRequestFor), langs);
// Prompt for player p: results[i].translations[p.baseLanguage]?.word ?? picked[i].english
```

A game that changes nothing keeps working: it shows `english` to everyone, as before, and
a Russian-base player now has cards. A card of a pair without English that the catalog
has not resolved to a meaning has no `source_lemma` and is still dropped.

In the browser, `translator:init` carries `uiLocale` (interface language) and
`explanationLang` (the player's base language) for the game's own texts.

## Card meanings (0.6 types / 0.7 runtime)

One English word can back several cards: `watch` the timepiece and `watch` the verb, or
`march` the walk and `march` the month. Cards now say which meaning they hold.

- `Card.senseKey` names the meaning, `Card.senseGloss` is its short English note, and
  `Card.sourceLemma` is the dictionary form (`car` for a card that reads `the car`). All
  three are absent on legacy cards.
- A game that pools cards into concepts should key them by
  `(english, partOfSpeech, senseKey)` and fall back to the English word only when
  `senseKey` is absent. When two cards in play share an English word, show `senseGloss`
  under the prompt.
- `ctx.translate(["march"])` still returns the primary meaning. To show an opponent the
  meaning a card was saved on, use `ctx.translateSenses`:

```ts
import { senseRequestFor } from "@memdecks/mp-runtime";

const results = ctx.translateSenses
  ? await ctx.translateSenses(picked.map(senseRequestFor), langs)
  : [];
// results[i] answers picked[i]; results[i].translations[lang] is a CardTranslation or null.
```

A language that lacks the meaning gets the primary one, and then the returned
`translations[lang].senseKey` differs from the requested key. Against a platform that
predates meanings, the default provider falls back to translating by word.

`defaultCardProvider` used to pass `/api/cards` rows through untouched, so a game on it got
snake_case rows typed as `Card`. It now returns real `Card` objects, meaning included; rows
without an English side or a study word are dropped. Games with their own `cardProvider`
are unaffected, and can map `sense_key`, `sense_gloss` and `source_lemma` themselves or call
`normalizeCardRow`.

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
