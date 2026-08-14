import type {
  Card,
  CardAudioResponse,
  ResolvedCardRef,
} from "@memdecks/mp-types";
import type { GameSession } from "./bridge";

export type CardAudioRef = string | Pick<Card, "id"> | Pick<ResolvedCardRef, "cardId">;

export interface PlayCardAudioOptions {
  volume?: number;
  playbackRate?: number;
}

export interface CardAudioClient {
  /** Resolve a playable URL without exposing storage buckets or media kinds. */
  resolve(card: CardAudioRef): Promise<CardAudioResponse>;
  /** Play the resolved audio. Returns null when this card has no audio. */
  play(card: CardAudioRef, options?: PlayCardAudioOptions): Promise<HTMLAudioElement | null>;
  /** Stop the sound most recently started by this client. */
  stop(): void;
  /** Drop one cached URL (or every cached URL when omitted). */
  clear(card?: CardAudioRef): void;
}

type CachedAudio = {
  response: CardAudioResponse;
  staleAt: number;
};

function cardIdOf(card: CardAudioRef): string {
  if (typeof card === "string") return card;
  if ("cardId" in card) return card.cardId;
  return card.id;
}

function cacheDeadline(response: CardAudioResponse): number {
  if (response.status === "unavailable") return Date.now() + 30_000;
  if (!response.expiresAt) return Number.POSITIVE_INFINITY;
  const expires = Date.parse(response.expiresAt);
  return Number.isFinite(expires) ? Math.max(Date.now(), expires - 15_000) : Date.now();
}

/**
 * Browser-side audio facade for both imported attachments and generated TTS.
 * The GameSession object is intentionally read at request time because mp-client mutates
 * its tokens in place when the host sends translator:token_refresh.
 */
export function createCardAudio(session: GameSession): CardAudioClient {
  const cache = new Map<string, CachedAudio>();
  const pending = new Map<string, Promise<CardAudioResponse>>();
  let active: HTMLAudioElement | null = null;

  const resolve = async (card: CardAudioRef): Promise<CardAudioResponse> => {
    const cardId = cardIdOf(card).trim();
    if (!cardId) throw new Error("A card id is required to resolve audio.");

    const cached = cache.get(cardId);
    if (cached && cached.staleAt > Date.now()) return cached.response;
    const existing = pending.get(cardId);
    if (existing) return existing;

    const request = (async () => {
      const token = session.gameToken ?? session.accessToken;
      if (!token) throw new Error("No token in session; cannot resolve card audio.");
      const base = session.apiBase.replace(/\/+$/, "");
      const response = await fetch(
        `${base}/api/cards/${encodeURIComponent(cardId)}/audio`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = (await response.json().catch(() => null)) as
        | CardAudioResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        const message = body && "error" in body ? body.error : undefined;
        throw new Error(message ?? `Card audio fetch failed (${response.status}).`);
      }
      const result = body as CardAudioResponse;
      if (!result || (result.status !== "ready" && result.status !== "unavailable")) {
        throw new Error("Card audio response was invalid.");
      }
      cache.set(cardId, { response: result, staleAt: cacheDeadline(result) });
      return result;
    })().finally(() => pending.delete(cardId));

    pending.set(cardId, request);
    return request;
  };

  return {
    resolve,
    async play(card, options = {}) {
      const result = await resolve(card);
      if (result.status === "unavailable") return null;

      if (active) {
        active.pause();
        active.currentTime = 0;
      }
      const audio = new Audio(result.url);
      if (options.volume !== undefined) audio.volume = options.volume;
      if (options.playbackRate !== undefined) audio.playbackRate = options.playbackRate;
      active = audio;
      await audio.play();
      return audio;
    },
    stop() {
      if (!active) return;
      active.pause();
      active.currentTime = 0;
      active = null;
    },
    clear(card) {
      if (card === undefined) {
        cache.clear();
        pending.clear();
        return;
      }
      const cardId = cardIdOf(card);
      cache.delete(cardId);
      pending.delete(cardId);
    },
  };
}
