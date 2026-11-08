/**
 * Single-player memdecks game (client-only, no server, no GameModule).
 *
 * `initGame()` does the handshake with the memdecks site and `fetchUserCards()` pulls the
 * player's deck. With `demo` on, a run outside the site (`npm run dev`) gets sample cards,
 * so you can build the game before it is listed. Replace `startGame` with your game.
 */
import {
  createCardAudio,
  initGame,
  fetchUserCards,
  type Card,
  type CardAudioClient,
} from "@memdecks/mp-client";

const app = document.querySelector<HTMLDivElement>("#app")!;

async function main(): Promise<void> {
  const { session, close } = await initGame({ demo: import.meta.env.DEV });

  if (!session) {
    app.textContent = "Open this game from memdecks.com.";
    return;
  }

  const lang = session.targetLang ?? "hy";
  const cards = (await fetchUserCards(session)).filter((c) => c.translations[lang]?.word);
  const audio = createCardAudio(session);
  startGame(cards, lang, audio, close);
}

/** The example game: pick the study word that matches the prompt. */
function startGame(cards: Card[], lang: string, audio: CardAudioClient, close: () => void): void {
  if (cards.length < 4) {
    app.textContent = "Add at least 4 words to play.";
    return;
  }
  let score = 0;
  let round = 0;
  const rounds = Math.min(10, cards.length);

  const next = (): void => {
    if (round === rounds) {
      app.innerHTML = "";
      app.append(text("h2", `Score: ${score} / ${rounds}`), button("Close", close));
      return;
    }
    round += 1;
    const answer = pick(cards, 1)[0];
    const options = shuffle([answer, ...pick(cards.filter((c) => c !== answer), 3)]);

    app.innerHTML = "";
    app.append(text("p", `Round ${round} of ${rounds}`), text("h2", answer.prompt ?? answer.english));
    for (const option of options) {
      app.append(
        button(option.translations[lang]!.word, () => {
          if (option === answer) score += 1;
          void audio.play(answer).catch(() => null);
          next();
        }),
      );
    }
  };
  next();
}

function text(tag: "h2" | "p", value: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = value;
  return el;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.textContent = label;
  el.style.cssText = "display:block;margin:8px 0;padding:8px 16px;font-size:18px";
  el.addEventListener("click", onClick);
  return el;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, count);
}

void main();
