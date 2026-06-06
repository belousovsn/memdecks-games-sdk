/**
 * The Translator postMessage bridge, game side.
 *
 * Call `initGame()` on mount: it sends `game:ready`, waits for `translator:init`,
 * keeps handling `translator:token_refresh`, and exposes `close()` / `reportResult()`.
 * Works standalone too (no host): resolves with `session: null` after a short timeout.
 */
import type {
  GameResult,
  MatchHandoff,
  ResolvedCardRef,
  TranslatorInitMessage,
  TranslatorTokenRefreshMessage,
} from "@memdecks/mp-types";

/** Resolved identity + handoff the host handed down. */
export interface GameSession {
  apiBase: string;
  userId?: string;
  /** Legacy Supabase token (also used for client-side TTS). */
  accessToken?: string | null;
  /** Scoped card token (mutated in place on token refresh). */
  gameToken?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  /** Present for multiplayer/solo: how to join the formed match. */
  match?: MatchHandoff;
  /** Optional contract-filtered card set (legacy resolver path). */
  cards?: ResolvedCardRef[];
}

export interface InitOptions {
  /** Override how long to wait for `translator:init` before resolving `null`. */
  timeoutMs?: number;
  /** Called whenever the host pushes refreshed tokens. */
  onTokenRefresh?: (tokens: { accessToken?: string; gameToken?: string }) => void;
  /** Origin to post messages to the parent with. Default "*". */
  parentOrigin?: string;
}

export interface TranslatorBridge {
  /** The init session, or `null` when running standalone with no host. */
  session: GameSession | null;
  /** Tell the host to close the game overlay. */
  close(): void;
  /** Send a result up to the host. */
  reportResult(result: GameResult): void;
}

function toSession(init: TranslatorInitMessage): GameSession {
  const s: GameSession = { apiBase: init.apiBase };
  if (init.userId !== undefined) s.userId = init.userId;
  if (init.accessToken !== undefined) s.accessToken = init.accessToken;
  if (init.gameToken !== undefined) s.gameToken = init.gameToken;
  if (init.supabaseUrl !== undefined) s.supabaseUrl = init.supabaseUrl;
  if (init.supabaseKey !== undefined) s.supabaseKey = init.supabaseKey;
  if (init.match !== undefined) s.match = init.match;
  if (init.cards !== undefined) s.cards = init.cards;
  return s;
}

export async function initGame(options: InitOptions = {}): Promise<TranslatorBridge> {
  const noop: TranslatorBridge = {
    session: null,
    close() {},
    reportResult() {},
  };
  if (typeof window === "undefined") return noop;

  const parentOrigin = options.parentOrigin ?? "*";
  const inIframe = window.parent !== window;
  const timeoutMs = options.timeoutMs ?? (inIframe ? 3000 : 100);
  const post = (msg: unknown) => window.parent.postMessage(msg, parentOrigin);

  let session: GameSession | null = null;

  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string } | null;
    if (!data || typeof data !== "object") return;
    if (data.type === "translator:init") {
      session = toSession(data as TranslatorInitMessage);
      if (!settled) {
        settled = true;
        resolveSession(session);
      }
    } else if (data.type === "translator:token_refresh") {
      const r = data as TranslatorTokenRefreshMessage;
      if (session) {
        if (r.accessToken !== undefined) session.accessToken = r.accessToken;
        if (r.gameToken !== undefined) session.gameToken = r.gameToken;
      }
      options.onTokenRefresh?.({
        ...(r.accessToken !== undefined ? { accessToken: r.accessToken } : {}),
        ...(r.gameToken !== undefined ? { gameToken: r.gameToken } : {}),
      });
    }
  };

  let settled = false;
  let resolveSession!: (s: GameSession | null) => void;
  const sessionReady = new Promise<GameSession | null>((resolve) => {
    resolveSession = resolve;
  });

  // The message listener stays attached for the lifetime of the game so
  // token_refresh keeps working after init resolves.
  window.addEventListener("message", onMessage);
  post({ type: "game:ready" });
  window.setTimeout(() => {
    if (!settled) {
      settled = true;
      resolveSession(null);
    }
  }, timeoutMs);

  session = await sessionReady;

  return {
    session,
    close() {
      post({ type: "game:close" });
    },
    reportResult(result: GameResult) {
      post({ type: "game:result", result });
    },
  };
}
