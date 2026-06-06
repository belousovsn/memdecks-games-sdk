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
  /** TTS audio file name/path; resolve against Supabase storage on the client. */
  ttsFile?: string;
}

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
}
