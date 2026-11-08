# memdecks-games-sdk

Build word games for [memdecks.com](https://memdecks.com), a site where people collect the
words they know in the language they're learning.

Every game on memdecks is a separate web app. You host it wherever you like, and the site
opens it in an iframe. Your game gets the player's words, translations and audio. The site
handles accounts, word lists and progress. Multiplayer games also get a lobby,
matchmaking and players who study different languages in one match.

If your game is fun, we'll add it to the site.

## Make a single-player game in two minutes

```bash
npx degit belousovsn/memdecks-games-sdk/templates/single-player-game my-game
cd my-game
npm install
npm run dev
```

Open http://localhost:5173. Outside memdecks there is no player, so the game runs in demo
mode with twelve sample cards in Armenian, Greek, Russian and Spanish. The template is a
small working quiz; replace `startGame` in `src/main.ts` with your game. Any framework
works.

The whole API you need:

```ts
import { initGame, fetchUserCards, createCardAudio } from "@memdecks/mp-client";

const { session, close } = await initGame({ demo: import.meta.env.DEV });
const cards = await fetchUserCards(session!);   // the player's words
const lang = session!.targetLang;               // the language they study, e.g. "hy"
cards[0].translations[lang!]?.word;             // "կատու"
await createCardAudio(session!).play(cards[0]); // pronunciation, when the site has it
close();                                        // back to memdecks
```

A card has an English word that names the concept, an optional `prompt` in the player's
own language, and a translation per study language. See `Card` in
[`@memdecks/mp-types`](packages/mp-types/src/cards.ts).

## Make a multiplayer game

You write the rules as one `GameModule`. The SDK runs the match server, checks who is
playing, deals the cards and sends every player their own view.

```bash
npx degit belousovsn/memdecks-games-sdk/templates/multiplayer-game my-mp-game
cd my-mp-game
npm install
npm run build
MATCH_TICKET_SECRET=dev-secret PORT=4601 npm start
```

To play a match locally, sign a test ticket with the same secret and pass your own cards
to the server. [`examples/speed-match/smoke.mjs`](examples/speed-match/smoke.mjs) does
exactly that in 50 lines, and [`examples/speed-match`](examples/speed-match) is a full
working game.

Players often study different languages. `ctx.translate` gives you the words a match
picked in every player's language, so they can still play the same round. See
[AGENTS.md](AGENTS.md#cross-language-play-ctxtranslate).

## Get your game on memdecks

1. Host the game on HTTPS, at the root of its domain or subdomain.
2. Check that it works with the demo deck and that `close()` is wired to an exit button.
3. [Open an issue](https://github.com/belousovsn/memdecks-games-sdk/issues/new?template=add-a-game.md)
   with the link, a screenshot and a line about how it plays.

We play it, and if it fits, we add it to the site. Single-player games need nothing else.
For a multiplayer game we agree on where its match server runs and share the ticket key.

## Packages

| Package | What it is for |
|---|---|
| [`@memdecks/mp-client`](packages/mp-client) | Browser side: connecting to the site, the player's cards, audio, joining a match |
| [`@memdecks/mp-runtime`](packages/mp-runtime) | Match server for multiplayer games (Socket.IO, lobby handoff, tickets, cards, translation) |
| [`@memdecks/mp-types`](packages/mp-types) | Shared types: cards, messages, `GameModule`, match tickets |

All three are on npm under the MIT license.

## Rules every game follows

1. The player is who the site says they are. Never trust a user id sent by a client, and
   never put an API key in a game.
2. In multiplayer, the server state is the truth. Clients render the view they get and
   send actions.
3. Hide each player's secrets in `viewFor`.
4. Don't build storage URLs for audio or images yourself. Use `createCardAudio` and the
   URLs on the card.

## Play card audio

`createCardAudio` plays imported Anki audio and generated speech through the same call:

```ts
import { createCardAudio, initGame } from "@memdecks/mp-client";

const { session } = await initGame();
if (session) {
  const audio = createCardAudio(session);
  await audio.play(card); // Card, resolved card reference, or card id
  await audio.play({ text: "γάτα", lang: "el" }); // a word the player has no card for
}
```

In demo mode every card is silent.

## Building with an AI agent

[CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) describe the contract for coding agents,
and each template has its own `AGENTS.md`.

## Working on the SDK itself

```bash
npm install
npm run build      # builds the three packages in dependency order
node smoke.mjs     # runtime smoke test
node examples/speed-match/smoke.mjs
```

Release notes are in [UPGRADING.md](UPGRADING.md) and each package's `CHANGELOG.md`.

### Publishing

Both the games and the memdecks site depend on these packages, so the contract can't
drift between them.

1. Bump versions and note the change in `UPGRADING.md`.
2. Publish in order: `@memdecks/mp-types`, then `@memdecks/mp-runtime` and
   `@memdecks/mp-client` (`npm publish -w <pkg>`).
3. The site and the games then raise their dependency in a reviewed change.

### Reporting to the platform

`mp-runtime` 0.4.0 and later report each match's launch, result and abandonment to the
platform, authorized per player by their card token. It never affects gameplay; turn it
off with `MEMDECKS_REPORT_LIFECYCLE=false`. Per-answer events (`card_practiced`) for
learning statistics are planned as a runtime helper.

## License

[MIT](LICENSE)
