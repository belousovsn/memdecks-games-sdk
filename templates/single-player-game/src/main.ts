/**
 * Single-player memdecks game (client-only — no server, no GameModule).
 *
 * It just needs identity + the player's cards over the bridge. `initGame()` handles the
 * `translator:init` handshake; `fetchUserCards()` pulls the deck with the scoped token.
 * Wire this into your framework of choice (this file is framework-agnostic).
 */
import { initGame, fetchUserCards, type Card } from "@memdecks/mp-client";

async function main(): Promise<void> {
  const { session, close } = await initGame();

  if (!session) {
    // Running standalone (not inside the Translator host). Show a "open me from
    // Translator" message, or a dev login, then return.
    console.warn("No Translator session — open this game from the Translator app.");
    return;
  }

  const cards = await fetchUserCards(session);
  startGame(cards, close);
}

function startGame(cards: Card[], close: () => void): void {
  // TODO: render and run your single-player game using `cards`.
  // Call `close()` when the player exits to return to Translator.
  console.log(`Loaded ${cards.length} cards. Build your game here.`);
}

void main();
