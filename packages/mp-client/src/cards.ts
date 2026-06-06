/**
 * Client-side card fetch — primarily for single-player games (which have no server
 * to provision their deck). Multiplayer games don't need this: the runtime fetches
 * cards server-side from the match ticket.
 */
import type { Card } from "@memdecks/mp-types";
import type { GameSession } from "./bridge";

/** Fetch the signed-in user's cards from the Translator API using the session's token. */
export async function fetchUserCards(session: GameSession): Promise<Card[]> {
  const token = session.gameToken ?? session.accessToken;
  if (!token) throw new Error("No token in session; cannot fetch cards.");
  const base = session.apiBase.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/cards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Card fetch failed (${res.status}).`);
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as Card[]) : [];
}
