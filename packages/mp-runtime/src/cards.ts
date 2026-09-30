/**
 * Card provisioning. By default the runtime fetches a player's cards from the
 * Translator API using the scoped card token carried in their match ticket — so no
 * admin key lives in any game. Operators can inject a custom provider if needed.
 */
import type { Card, CardTranslation, PartOfSpeech } from "@memdecks/mp-types";

export interface CardProviderArgs {
  userId: string;
  /** Scoped card token from the match ticket (Bearer for /api/cards). */
  cardToken?: string;
  /** Translator API base URL. */
  apiBase: string;
}

export type CardProvider = (args: CardProviderArgs) => Promise<Card[]>;

const PARTS_OF_SPEECH: readonly PartOfSpeech[] = ["noun", "verb", "adjective", "adverb", "phrase"];

/** A Translator `Cards` row as `/api/cards` returns it (snake_case, one language pair). */
interface ApiCardRow {
  id?: string;
  source_lang?: string;
  target_lang?: string;
  source_word?: string;
  target_word?: string;
  source_lemma?: string | null;
  source_pos?: string | null;
  part_of_speech?: string | null;
  sense_key?: string | null;
  sense_gloss?: string | null;
  transliteration?: string | null;
  img_url_small?: string | null;
  img_url_large?: string | null;
  ttsfile?: string | null;
}

function isCard(value: unknown): value is Card {
  const card = value as Partial<Card> | null;
  return !!card && typeof card.english === "string" && typeof card.translations === "object";
}

function toPartOfSpeech(value: unknown): PartOfSpeech | undefined {
  return typeof value === "string" && (PARTS_OF_SPEECH as readonly string[]).includes(value)
    ? (value as PartOfSpeech)
    : undefined;
}

/**
 * One `/api/cards` row → SDK Card, or null without an English side and a study word.
 * Carries the card's meaning (`senseKey`, `senseGloss`, `sourceLemma`) so a game can tell
 * two cards of one English word apart.
 */
export function normalizeCardRow(row: unknown): Card | null {
  if (isCard(row)) return row;
  const r = (row ?? {}) as ApiCardRow;
  if (!r.id) return null;

  const englishSide = r.source_lang === "en" ? "source" : r.target_lang === "en" ? "target" : null;
  if (!englishSide) return null;
  const english = englishSide === "source" ? r.source_word : r.target_word;
  const language = englishSide === "source" ? r.target_lang : r.source_lang;
  const word = englishSide === "source" ? r.target_word : r.source_word;
  if (!english || !language || !word) return null;

  const translation: CardTranslation = {
    word,
    ...(r.transliteration ? { transliteration: r.transliteration } : {}),
    ...(r.ttsfile ? { ttsFile: r.ttsfile } : {}),
    ...(r.sense_key ? { senseKey: r.sense_key } : {}),
    ...(r.sense_gloss ? { briefGloss: r.sense_gloss } : {}),
  };
  const partOfSpeech = toPartOfSpeech(r.source_pos) ?? toPartOfSpeech(r.part_of_speech);
  const imageUrl = r.img_url_small || r.img_url_large;

  return {
    id: r.id,
    english,
    ...(partOfSpeech ? { partOfSpeech } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    translations: { [language]: translation },
    ...(r.source_lemma ? { sourceLemma: r.source_lemma } : {}),
    ...(r.sense_key ? { senseKey: r.sense_key } : {}),
    ...(r.sense_gloss ? { senseGloss: r.sense_gloss } : {}),
  };
}

/**
 * Default provider: GET {apiBase}/api/cards with the scoped token, normalized to Card.
 * Rows that are already Card-shaped pass through unchanged.
 */
export const defaultCardProvider: CardProvider = async ({ cardToken, apiBase }) => {
  if (!cardToken) {
    throw new Error("No scoped card token in match ticket; cannot fetch cards.");
  }
  const base = apiBase.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/cards`, {
    headers: { Authorization: `Bearer ${cardToken}` },
  });
  if (!res.ok) {
    throw new Error(`Card fetch failed (${res.status}).`);
  }
  const data: unknown = await res.json();
  return Array.isArray(data)
    ? data.map(normalizeCardRow).filter((card): card is Card => card !== null)
    : [];
};
