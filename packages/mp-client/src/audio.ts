import type {
  Card,
  CardAudioResponse,
  ResolvedCardRef,
} from "@memdecks/mp-types";
import type { GameSession } from "./bridge";

/**
 * A word to pronounce by its text and language instead of by card. Use it for a word the
 * player holds no card for: one drafted from a co-player's deck, or one the platform
 * translated for the match. The platform answers card audio only to the card's owner.
 */
export interface WordAudioRef {
  text: string;
  lang: string;
}

export type CardAudioRef = string | Pick<Card, "id"> | Pick<ResolvedCardRef, "cardId"> | WordAudioRef;

export interface PlayCardAudioOptions {
  volume?: number;
  playbackRate?: number;
}

export interface CardAudioClient {
  /**
   * Resolve a playable URL without exposing storage buckets or media kinds. A word that the
   * platform is still synthesizing answers `unavailable`; that answer is kept for 30 seconds,
   * so asking again later picks the audio up.
   */
  resolve(card: CardAudioRef): Promise<CardAudioResponse>;
  /** Play the resolved audio. Returns null when this card or word has no audio. */
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

function isWordRef(ref: CardAudioRef): ref is WordAudioRef {
  return typeof ref === "object" && "text" in ref && "lang" in ref;
}

function cardIdOf(card: Exclude<CardAudioRef, WordAudioRef>): string {
  if (typeof card === "string") return card;
  if ("cardId" in card) return card.cardId;
  return card.id;
}

/** Where a reference is fetched from, and the key it is cached under. */
function locate(ref: CardAudioRef): { key: string; path: string; word: boolean } {
  if (isWordRef(ref)) {
    const text = ref.text.trim();
    const lang = ref.lang.trim();
    if (!text || !lang) throw new Error("A word and its language are required to resolve audio.");
    return {
      key: `word:${lang}:${text}`,
      path: `/api/cards/word-audio?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`,
      word: true,
    };
  }
  const cardId = cardIdOf(ref).trim();
  if (!cardId) throw new Error("A card id is required to resolve audio.");
  return { key: cardId, path: `/api/cards/${encodeURIComponent(cardId)}/audio`, word: false };
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
    const { key, path, word } = locate(card);

    const cached = cache.get(key);
    if (cached && cached.staleAt > Date.now()) return cached.response;
    const existing = pending.get(key);
    if (existing) return existing;

    const request = (async () => {
      const token = session.gameToken ?? session.accessToken;
      if (!token) throw new Error("No token in session; cannot resolve card audio.");
      const base = session.apiBase.replace(/\/+$/, "");
      const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      // A platform that predates word audio has no such route: the word stays silent.
      if (word && response.status === 404) {
        const silent: CardAudioResponse = { status: "unavailable" };
        cache.set(key, { response: silent, staleAt: cacheDeadline(silent) });
        return silent;
      }
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
      cache.set(key, { response: result, staleAt: cacheDeadline(result) });
      return result;
    })().finally(() => pending.delete(key));

    pending.set(key, request);
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
      const { key } = locate(card);
      cache.delete(key);
      pending.delete(key);
    },
  };
}
