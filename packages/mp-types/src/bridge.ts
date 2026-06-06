/**
 * postMessage bridge contract between the Translator parent (host) and a game iframe.
 *
 * The SAME types are imported by the private Translator client (the sender) and by
 * every game (the receiver), so the contract cannot drift — see the SDK README.
 */
import type { GameResult } from "./game-module";
import type { MatchHandoff } from "./match";

/** Contract-filtered card reference from `POST /api/games/resolve`. */
export interface ResolvedCardRef {
  cardId: string;
  wordId: string;
}

/** Messages the GAME (iframe) sends UP to the Translator parent. */
export type GameToParentMessage =
  | { type: "game:ready" }
  | { type: "game:close" }
  | { type: "game:result"; result: GameResult };

/** The init payload the parent sends DOWN once the game signals `game:ready`. */
export interface TranslatorInitMessage {
  type: "translator:init";
  /** Base URL of the Translator public API (e.g. https://test.memdecks.com). */
  apiBase: string;
  /** Resolved Translator user id, when known. */
  userId?: string;
  /**
   * Legacy Supabase access token. Still provided for client-side TTS (Supabase
   * storage). Prefer `gameToken` for API/server calls.
   */
  accessToken?: string | null;
  /** Scoped, short-lived card token for server-side card fetches. */
  gameToken?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  /** Present for multiplayer AND solo: how to join the formed match. */
  match?: MatchHandoff;
  /** Optional contract-filtered card set (legacy resolver path). */
  cards?: ResolvedCardRef[];
}

/** Refreshed tokens pushed by the parent while the iframe stays open. */
export interface TranslatorTokenRefreshMessage {
  type: "translator:token_refresh";
  accessToken?: string;
  gameToken?: string;
}

/** Messages the Translator parent sends DOWN to the game iframe. */
export type ParentToGameMessage =
  | TranslatorInitMessage
  | TranslatorTokenRefreshMessage;
