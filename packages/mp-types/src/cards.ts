/**
 * Card model — the normalized shape games receive for a player's deck.
 *
 * Source of truth is the Translator API; the runtime fetches and normalizes cards,
 * then hands them to a GameModule via MatchContext.cards.
 */

/**
 * Language code. `'en'` is the prompt/source language; studied languages are codes
 * like `'hy'` (Armenian), `'gr'` (Greek), `'ru'` (Russian). Kept open as `string`
 * so new languages don't require an SDK release.
 */
export type LanguageCode = string;

export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "phrase";

/** A single word in one target language. */
export interface CardTranslation {
  /** The word in the target language. */
  word: string;
  /** Romanized form, when available. */
  transliteration?: string;
  /** Legacy generated-TTS file name/path. Prefer mp-client's card audio resolver. */
  ttsFile?: string;
  /**
   * The meaning this word translates, e.g. `"month"` for March the month. Absent when the
   * platform does not know the meaning (a legacy card, or a machine-translated miss).
   */
  senseKey?: string;
  /** Short English note for that meaning, e.g. `"third month of the year"`. */
  briefGloss?: string;
}

/** Response from the platform's card-first audio endpoint. */
export type CardAudioResponse =
  | {
      status: "ready";
      source: "imported" | "tts";
      url: string;
      /** Expiry for short-lived private/signed URLs. */
      expiresAt?: string;
    }
  | { status: "unavailable" };

/** A study card: an English prompt + image, with one or more target-language translations. */
export interface Card {
  /** Stable Translator card id. */
  id: string;
  /** English prompt shown to the player. */
  english: string;
  partOfSpeech?: PartOfSpeech;
  /** Image to reveal/show during play. */
  imageUrl?: string;
  /** Per-language translations, keyed by LanguageCode. */
  translations: Partial<Record<LanguageCode, CardTranslation>>;
  /** Dictionary form of the English word, when the card is catalog-backed. */
  sourceLemma?: string;
  /**
   * Which meaning of the English word the card was saved on. One English word can back
   * several cards (`watch` the timepiece, `watch` the verb), so a game that pools cards
   * into concepts should key them by `(english, partOfSpeech, senseKey)`, and fall back to
   * the English word only when `senseKey` is absent. Absent on legacy cards.
   */
  senseKey?: string;
  /** Short English note for the meaning; show it when two cards in play share a word. */
  senseGloss?: string;
}

/** One meaning of an English word, as `ctx.translateSenses` asks for it. */
export interface TranslateSenseRequest {
  /** English dictionary form: the card's `sourceLemma`, else its `english`. */
  word: string;
  /** Part of speech. Send it: sense keys belong to one lexeme, and `"main"` is on all. */
  pos?: string;
  senseKey?: string;
}

