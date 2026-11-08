/**
 * Demo mode: run a game outside the memdecks site with a sample deck.
 *
 * `initGame({ demo: true })` returns a demo session when no host answers. Card fetches
 * return the sample deck and audio answers `unavailable`, so nothing goes over the network.
 * Inside the memdecks site the real session always wins.
 */
import type { Card } from "@memdecks/mp-types";

export interface DemoOptions {
  /** Cards to play with. Default: `DEMO_CARDS`. */
  cards?: Card[];
  /** Study language of the demo player. Default: `"hy"`. */
  targetLang?: string;
  /** Interface language of the demo player. Default: `"en"`. */
  uiLocale?: string;
}

function card(
  id: string,
  english: string,
  hy: [string, string],
  gr: [string, string],
  ru: string,
  es: string,
): Card {
  return {
    id: `demo-${id}`,
    english,
    partOfSpeech: "noun",
    translations: {
      hy: { word: hy[0], transliteration: hy[1] },
      gr: { word: gr[0], transliteration: gr[1] },
      ru: { word: ru },
      es: { word: es },
    },
  };
}

/** Twelve everyday nouns in Armenian (`hy`), Greek (`gr`), Russian (`ru`) and Spanish (`es`). */
export const DEMO_CARDS: readonly Card[] = Object.freeze([
  card("cat", "cat", ["կատու", "katu"], ["γάτα", "gata"], "кошка", "gato"),
  card("dog", "dog", ["շուն", "shun"], ["σκύλος", "skylos"], "собака", "perro"),
  card("sun", "sun", ["արև", "arev"], ["ήλιος", "ilios"], "солнце", "sol"),
  card("moon", "moon", ["լուսին", "lusin"], ["φεγγάρι", "fengari"], "луна", "luna"),
  card("water", "water", ["ջուր", "jur"], ["νερό", "nero"], "вода", "agua"),
  card("bread", "bread", ["հաց", "hats"], ["ψωμί", "psomi"], "хлеб", "pan"),
  card("house", "house", ["տուն", "tun"], ["σπίτι", "spiti"], "дом", "casa"),
  card("book", "book", ["գիրք", "girk"], ["βιβλίο", "vivlio"], "книга", "libro"),
  card("tree", "tree", ["ծառ", "tsar"], ["δέντρο", "dentro"], "дерево", "árbol"),
  card("apple", "apple", ["խնձոր", "khndzor"], ["μήλο", "milo"], "яблоко", "manzana"),
  card("friend", "friend", ["ընկեր", "enker"], ["φίλος", "filos"], "друг", "amigo"),
  card("city", "city", ["քաղաք", "kaghak"], ["πόλη", "poli"], "город", "ciudad"),
]);
