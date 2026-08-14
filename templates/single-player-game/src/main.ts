/**
 * Single-player memdecks game (client-only — no server, no GameModule).
 *
 * It just needs identity + the player's cards over the bridge. `initGame()` handles the
 * `translator:init` handshake; `fetchUserCards()` pulls the deck with the scoped token.
 * Wire this into your framework of choice (this file is framework-agnostic).
 */
import {
  createCardAudio,
  initGame,
  fetchUserCards,
  type Card,
  type CardAudioClient,
} from "@memdecks/mp-client";

async function main(): Promise<void> {
  const { session, close } = await initGame();

  if (!session) {
    // Running standalone (not inside the Translator host). Show a "open me from
    // Translator" message, or a dev login, then return.
    console.warn("No Translator session — open this game from the Translator app.");
    return;
  }

  const cards = await fetchUserCards(session);
  const audio = createCardAudio(session);
  startGame(cards, audio, close);
}

function startGame(cards: Card[], audio: CardAudioClient, close: () => void): void {
  // TODO: render and run your single-player game using `cards`.
  // Use `await audio.play(card)` for either imported audio or generated TTS.
  // Call `close()` when the player exits to return to Translator.
  void audio;
  void close;
  console.log(`Loaded ${cards.length} cards. Build your game here.`);
}

void main();
