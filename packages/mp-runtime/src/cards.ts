/**
 * Card provisioning. By default the runtime fetches a player's cards from the
 * Translator API using the scoped card token carried in their match ticket — so no
 * admin key lives in any game. Operators can inject a custom provider if needed.
 */
import type { Card } from "@memdecks/mp-types";

export interface CardProviderArgs {
  userId: string;
  /** Scoped card token from the match ticket (Bearer for /api/cards). */
  cardToken?: string;
  /** Translator API base URL. */
  apiBase: string;
}

export type CardProvider = (args: CardProviderArgs) => Promise<Card[]>;

/**
 * Default provider: GET {apiBase}/api/cards with the scoped token.
 *
 * NOTE (phase 4): the exact `/api/cards` response shape is owned by the private
 * Translator API. This passes through an array of Card-shaped rows; if the deployed
 * shape differs, align it here or inject a custom provider via createMultiplayerServer.
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
  return Array.isArray(data) ? (data as Card[]) : [];
};
