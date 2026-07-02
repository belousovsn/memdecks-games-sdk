/**
 * Lifecycle reporting (runtime -> platform).
 *
 * The runtime is the only party that directly observes a match's lifecycle
 * (launch / result / abandon), so it pushes those moments to the platform's
 * server-owned game session ledger (Translator-app#177). This feeds learning
 * progress + analytics and lets the platform detect "match over" proactively
 * instead of polling each runtime's `/matches/:id/status`.
 *
 * Transport: `POST {apiBase}/api/games/events`, authorized per player by that
 * player's scoped **card token** (the same token the ticket already carries) —
 * no admin key in the runtime. The platform constrains an event to the token's
 * own user + game, so the runtime can only report for players actually in the
 * match.
 *
 * Reporting is **best-effort telemetry**: failures (server down, token expired
 * on a long match) are logged once and swallowed — they never affect gameplay.
 * This is runtime->platform HTTP, not the game<->runtime wire protocol, so it is
 * additive and carries no PROTOCOL_VERSION change.
 */
import type { GameResult } from "@memdecks/mp-types";

export type LifecycleEventType = "launch" | "result" | "abandon";

/** One per-player lifecycle moment to push to the platform ledger. */
export interface LifecycleEvent {
  type: LifecycleEventType;
  matchId: string;
  gameId: string;
  /** The player this event is about (and whose card token authorizes it). */
  userId: string;
  seat?: number;
  role?: string;
  language?: string;
  /** Scoped card token authorizing the push for this player. */
  cardToken?: string;
  /** Present on `result`: the final GameResult to record. */
  result?: GameResult;
}

/** Fire-and-forget sink for lifecycle events. Implementations must not throw. */
export interface LifecycleReporter {
  report(event: LifecycleEvent): void;
}

/** A reporter that does nothing — used when reporting is disabled. */
export const noopReporter: LifecycleReporter = { report() {} };

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface HttpReporterOptions {
  /** Base URL of the Translator public API (same as card provisioning). */
  apiBase: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Injectable for tests; defaults to console. */
  logger?: Pick<Console, "warn">;
}

const EVENT_PATH = "/api/games/events";

/** Map a LifecycleEvent to the platform's `/api/games/events` request body. */
function toRequestBody(event: LifecycleEvent): Record<string, unknown> {
  const body: Record<string, unknown> = {
    matchId: event.matchId,
    gameId: event.gameId,
    userId: event.userId,
    eventType: event.type,
  };
  if (event.seat !== undefined) body["seat"] = event.seat;
  if (event.role !== undefined) body["role"] = event.role;
  if (event.language !== undefined) body["language"] = event.language;
  if (event.result !== undefined) body["payload"] = { result: event.result };
  return body;
}

/**
 * HTTP reporter that POSTs to the platform ledger. Best-effort: one warning per
 * failure, never throws into the caller.
 */
export function createHttpReporter(opts: HttpReporterOptions): LifecycleReporter {
  const base = opts.apiBase.replace(/\/+$/, "");
  const url = `${base}${EVENT_PATH}`;
  const doFetch: FetchLike = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const logger = opts.logger ?? console;

  return {
    report(event: LifecycleEvent): void {
      // A player with no card token can't be authorized; skip rather than 401-spam.
      if (!event.cardToken) return;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${event.cardToken}`,
      };
      // Fire-and-forget; isolate all failures.
      void Promise.resolve()
        .then(() =>
          doFetch(url, { method: "POST", headers, body: JSON.stringify(toRequestBody(event)) }),
        )
        .then(async (res) => {
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            logger.warn(
              `[mp-runtime] lifecycle ${event.type} push failed (${res.status}) for match ${event.matchId}: ${detail}`,
            );
          }
        })
        .catch((err: unknown) => {
          logger.warn(
            `[mp-runtime] lifecycle ${event.type} push error for match ${event.matchId}: ${(err as Error)?.message ?? String(err)}`,
          );
        });
    },
  };
}
