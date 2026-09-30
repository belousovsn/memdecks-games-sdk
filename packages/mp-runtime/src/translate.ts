/**
 * Word translation provisioning. Games may call `ctx.translate` from `createMatch` to
 * localize just the cards they picked (e.g. show one player's card to a co-player who
 * studies a different language). By default this proxies the Translator API's scoped
 * translate endpoint using the match's card token — so no admin key lives in any game.
 */
import type {
  Card,
  CardTranslation,
  TranslateFn,
  TranslateSenseRequest,
  TranslateSenseResult,
  TranslateSensesFn,
} from "@memdecks/mp-types";

export interface TranslateProviderArgs {
  /** Scoped card token from the match ticket (Bearer for /api/cards/translate). */
  cardToken?: string;
  /** Translator API base URL. */
  apiBase: string;
}

/** Builds the `ctx.translate` function for one match. */
export type TranslateProvider = (args: TranslateProviderArgs) => TranslateFn;

/**
 * Default provider: POST {apiBase}/api/cards/translate with the scoped token.
 * Body: { words: string[], languages: string[] }
 * Response: { translations: { [word]: { [lang]: CardTranslation | null } } }
 */
export const defaultTranslateProvider: TranslateProvider = ({ cardToken, apiBase }) => {
  return async (words, languages) => {
    if (!cardToken) {
      throw new Error("No scoped card token in match ticket; cannot translate.");
    }
    const base = apiBase.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/cards/translate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cardToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ words, languages }),
    });
    if (!res.ok) {
      throw new Error(`Translate call failed (${res.status}).`);
    }
    const data = (await res.json()) as {
      translations?: Record<string, Partial<Record<string, CardTranslation | null>>>;
    };
    return data.translations ?? {};
  };
};

/** Builds the `ctx.translateSenses` function for one match. */
export type TranslateSensesProvider = (args: TranslateProviderArgs) => TranslateSensesFn;

/**
 * Default provider: the same endpoint, with meaning objects in `words`.
 * Body: { words: TranslateSenseRequest[], languages: string[] }
 * Response: { senses: TranslateSenseResult[] } in request order.
 */
export const defaultTranslateSensesProvider: TranslateSensesProvider = ({ cardToken, apiBase }) => {
  return async (requests, languages) => {
    if (requests.length === 0) return [];
    if (!cardToken) {
      throw new Error("No scoped card token in match ticket; cannot translate.");
    }
    const base = apiBase.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/cards/translate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cardToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ words: requests, languages }),
    });
    if (!res.ok) {
      throw new Error(`Translate call failed (${res.status}).`);
    }
    const data = (await res.json()) as { senses?: TranslateSenseResult[] };
    if (Array.isArray(data.senses) && data.senses.length === requests.length) {
      const senses = data.senses;
      return requests.map((request, index) => ({
        ...request,
        translations: senses[index]?.translations ?? {},
      }));
    }

    // A platform that predates meanings ignores the objects. Ask again by word, which is
    // the primary meaning: what the game would have shown before this call existed.
    const byWord = await defaultTranslateProvider({ cardToken, apiBase })(
      [...new Set(requests.map((request) => request.word))],
      languages,
    );
    return requests.map((request) => ({
      ...request,
      translations: byWord[request.word] ?? {},
    }));
  };
};

/**
 * The request that translates exactly the meaning a card was saved on. A card with no
 * `senseKey` asks for the word's primary meaning, the same as the string form.
 */
export function senseRequestFor(card: Card): TranslateSenseRequest {
  return {
    word: card.sourceLemma || card.english,
    ...(card.partOfSpeech ? { pos: card.partOfSpeech } : {}),
    ...(card.senseKey ? { senseKey: card.senseKey } : {}),
  };
}
