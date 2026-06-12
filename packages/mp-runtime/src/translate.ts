/**
 * Word translation provisioning. Games may call `ctx.translate` from `createMatch` to
 * localize just the cards they picked (e.g. show one player's card to a co-player who
 * studies a different language). By default this proxies the Translator API's scoped
 * translate endpoint using the match's card token — so no admin key lives in any game.
 */
import type { CardTranslation, TranslateFn } from "@memdecks/mp-types";

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
