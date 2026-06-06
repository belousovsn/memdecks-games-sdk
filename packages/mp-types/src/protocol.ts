/**
 * Gameplay socket protocol — the standardized Socket.IO event vocabulary between a
 * game client and the operator's mp-runtime (Tier 2). This replaces the ad-hoc,
 * per-game event names (`guess`, `request_action`, ...) with one shared channel.
 */
import type { GameResult } from "./game-module";

export const MP_EVENTS = {
  /** client -> server: join the match using the signed match ticket. */
  join: "mp:join",
  /** client -> server: a discrete gameplay action. */
  action: "mp:action",
  /** server -> client: per-player view (from GameModule.viewFor). */
  state: "mp:state",
  /** server -> client: an extra per-player channel update (from GameModule.channelsFor). */
  channel: "mp:channel",
  /** server -> client: the match finished. */
  over: "mp:over",
  /** server -> client: an error (bad ticket, not in match, etc.). */
  error: "mp:error",
} as const;

export type MpEvent = (typeof MP_EVENTS)[keyof typeof MP_EVENTS];

export interface MpJoinPayload {
  matchTicket: string;
}

export interface MpActionPayload {
  /** Action name within the game's Action union. */
  action: string;
  payload?: Record<string, unknown>;
}

export interface MpChannelPayload {
  channel: string;
  data: unknown;
}

export interface MpOverPayload {
  result: GameResult;
}

export interface MpErrorPayload {
  message: string;
}
